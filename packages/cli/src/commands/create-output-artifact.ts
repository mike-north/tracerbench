import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import { join, resolve } from 'path';

import { Command } from '@oclif/command';
import {
    inputFilePath,
    outputFilePath,
} from '../helpers/flags';
import createConsumeableHTML, {
    TracerBenchTraceResult,
} from '../helpers/create-consumeable-html';

export default class CreateOutputArtifact extends Command {
    public static description = `Parses the output json from tracerbench and formats it into either a pdf or html`;
    public static flags = {
        inputFilePath: inputFilePath({ required: true }),
        outputFilePath: outputFilePath({ required: true }),
    };

    /**
     * Ensure the input file is valid and call the helper function "createConsumeableHTML"
     * to generate the HTML string for the output file.
     */
    public async run() {
        const { flags } = this.parse(CreateOutputArtifact);
        const { inputFilePath, outputFilePath } = flags;
        let chromeArgs;
        let absPathToHTML;
        let absOutputPath;
        let renderedHTML;
        let htmlOutputPath;

        let inputData: TracerBenchTraceResult[] = [];

        // If the input file cannot be found, exit with and error
        if (!fs.existsSync(inputFilePath)) {
            this.error(`Input json file does not exist. Please make sure ${inputFilePath} exists`, { exit: 1 });
        }

        try {
            inputData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
        } catch (error) {
            this.error(`Had issues parsing the input JSON file. Please make sure ${inputFilePath} is a valid JSON`, { exit: 1 });
        }
        const controlData = inputData.find((element) => {
            return element.set === 'control';
        });
        const experimentData = inputData.find((element) => {
            return element.set === 'experiment';
        });

        if (!controlData || !experimentData) {
            this.error(`Missing control or experiment set in JSON`, { exit: 1 });
        }

        // @ts-ignore
        renderedHTML = createConsumeableHTML(controlData, experimentData);
        if (!fs.existsSync(outputFilePath)) {
            fs.mkdirSync(outputFilePath, { recursive: true });
        }

        htmlOutputPath = join(outputFilePath, 'output.html');
        absPathToHTML = resolve(htmlOutputPath);

        fs.writeFileSync(absPathToHTML, renderedHTML);

        absOutputPath = resolve(join(outputFilePath + 'output.pdf'));
        chromeArgs = `--headless --disable-gpu --print-to-pdf=${absOutputPath} file://${absPathToHTML}`;
        execSync(`open chrome ${chromeArgs}`);
        this.log(`Written file out to ${outputFilePath}`);
    }
}