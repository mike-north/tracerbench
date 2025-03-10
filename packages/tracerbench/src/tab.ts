import { IDebuggingProtocolClient } from "chrome-debugging-client";
import {
  Emulation,
  HeapProfiler,
  Network,
  Page,
  Tracing
} from "chrome-debugging-client/dist/protocol/tot";
import Trace from "./trace/trace";

export interface ITab {
  isTracing: boolean;

  /** The current frame for the tab */
  frame: Page.Frame;
  onNavigate: (() => void) | undefined;
  /** Add a script to execute on load */
  addScriptToEvaluateOnLoad(source: string): Promise<Page.ScriptIdentifier>;
  /** Remove a previously added script */
  removeScriptToEvaluateOnLoad(
    identifier: Page.ScriptIdentifier
  ): Promise<void>;
  /** Navigates to the specified url */
  navigate(url: string, waitForLoad?: boolean): Promise<void>;
  /** Start tracing */
  startTracing(categories: string, options?: string): Promise<ITracing>;

  /** Clear browser cache and memory cache */
  clearBrowserCache(): Promise<void>;
  /** Perform GC */
  collectGarbage(): Promise<void>;

  setCPUThrottlingRate(rate: number): Promise<void>;
  emulateNetworkConditions(
    conditions: Network.EmulateNetworkConditionsParameters
  ): Promise<void>;
  disableNetworkEmulation(): Promise<void>;

  /** Configure tab to take on the device emulation settings */
  emulateDevice(deviceSettings: Emulation.SetDeviceMetricsOverrideParameters): Promise<void>;

  /** Cofigure tabe to send the specified user agent */
  setUserAgent(userAgentSettings: Emulation.SetUserAgentOverrideParameters): Promise<void>;
}

export default function createTab(
  id: string,
  client: IDebuggingProtocolClient,
  page: Page,
  frame: Page.Frame
): ITab {
  return new Tab(id, client, page, frame);
}

export interface ITracing {
  traceComplete: Promise<Trace>;
  end(): Promise<void>;
}

class Tab implements ITab {
  public isTracing = false;
  public tracingComplete: Promise<Trace> | undefined;

  /**
   * The current frame for the tab
   */
  public frame: Page.Frame;

  /**
   * Called when the frame navigates
   */
  public onNavigate: (() => void) | undefined = undefined;

  public id: string;
  public client: IDebuggingProtocolClient;

  private page: Page;
  private tracing: Tracing;
  private emulation: Emulation;
  private network: Network;
  private heapProfiler: HeapProfiler;

  constructor(
    id: string,
    client: IDebuggingProtocolClient,
    page: Page,
    frame: Page.Frame
  ) {
    this.id = id;
    this.client = client;
    this.page = page;
    this.frame = frame;
    this.tracing = new Tracing(client);
    this.network = new Network(client);
    this.emulation = new Emulation(client);
    this.heapProfiler = new HeapProfiler(client);
    page.frameNavigated = params => {
      const newFrame = params.frame;
      if (!newFrame.parentId) {
        this.frame = newFrame;
        if (this.onNavigate) {
          this.onNavigate();
        }
      }
    };
  }

  /**
   * Navigates to the specified url
   */
  public async navigate(url: string, waitForLoad?: boolean): Promise<void> {
    const { frame, page } = this;
    await Promise.all<any>([
      waitForLoad
        ? new Promise(resolve => {
            page.frameStoppedLoading = params => {
              if (params.frameId === frame.id) {
                page.frameStoppedLoading = null;
                resolve();
              }
            };
          })
        : undefined,
      frame.url === url ? page.reload({}) : page.navigate({ url })
    ]);
  }

  public async addScriptToEvaluateOnLoad(
    scriptSource: string
  ): Promise<Page.ScriptIdentifier> {
    const result = await this.page.addScriptToEvaluateOnLoad({ scriptSource });
    return result.identifier;
  }

  public async removeScriptToEvaluateOnLoad(
    identifier: Page.ScriptIdentifier
  ): Promise<void> {
    await this.page.removeScriptToEvaluateOnLoad({ identifier });
  }

  /** Start tracing */
  public async startTracing(
    categories: string,
    options?: string
  ): Promise<ITracing> {
    if (this.isTracing) {
      throw new Error("already tracing");
    }

    this.isTracing = true;

    const { tracing } = this;

    const traceComplete = (async () => {
      const trace = new Trace();

      tracing.dataCollected = evt => {
        trace.addEvents(evt.value);
      };

      await new Promise(resolve => {
        tracing.tracingComplete = () => {
          resolve();
        };
      });

      this.isTracing = false;

      tracing.tracingComplete = null;
      tracing.dataCollected = null;

      trace.buildModel();

      /*
        Chrome creates a new Renderer with a new PID each time we open a new tab,
        but the old PID and Renderer processes continues to hang around. Checking
        the length of the events array helps us to ensure we find the active tab's
        Renderer process.
      */
      trace.mainProcess = trace.processes
        .filter(p => p.name === "Renderer")
        .reduce((c, v) => (v.events.length > c.events.length ? v : c));

      return trace;
    })();

    const end = async () => {
      if (this.isTracing) {
        await tracing.end();
      }
    };

    await this.tracing.start({ categories, options });

    return { end, traceComplete };
  }

  /** Clear browser cache and memory cache */
  public async clearBrowserCache(): Promise<void> {
    const { network } = this;
    await network.enable({ maxTotalBufferSize: 0 });
    const res = await network.canClearBrowserCache();
    if (!res.result) {
      throw new Error("Cannot clear browser cache");
    }
    await network.clearBrowserCache();
    // causes MemoryCache entries to be evicted
    await network.setCacheDisabled({ cacheDisabled: true });
    await network.disable();
  }

  public async setCPUThrottlingRate(rate: number) {
    await this.emulation.setCPUThrottlingRate({ rate });
  }

  public async emulateNetworkConditions(
    conditions: Network.EmulateNetworkConditionsParameters
  ) {
    await this.network.enable({
      maxResourceBufferSize: 0,
      maxTotalBufferSize: 0
    });
    await this.network.emulateNetworkConditions(conditions);
  }

  public async disableNetworkEmulation() {
    await this.network.emulateNetworkConditions({
      downloadThroughput: 0,
      latency: 0,
      offline: false,
      uploadThroughput: 0
    });
    await this.network.disable();
  }

  public async collectGarbage(): Promise<void> {
    const { heapProfiler } = this;
    await heapProfiler.enable();
    await heapProfiler.collectGarbage();
    await heapProfiler.disable();
  }

  public async emulateDevice(deviceSettings: Emulation.SetDeviceMetricsOverrideParameters): Promise<void> {
    await this.emulation.setDeviceMetricsOverride(deviceSettings);
  }

  public async setUserAgent(userAgentSettings: Emulation.SetUserAgentOverrideParameters): Promise<void> {
    await this.emulation.setUserAgentOverride(userAgentSettings);
  }
}
