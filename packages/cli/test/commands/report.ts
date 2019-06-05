import { test } from '@oclif/test';
import * as chai from 'chai';
import * as path from 'path';
import Report from '../../src/commands/report';
import { tmpDir } from '../setup';


describe('create-output-artifact: creates html', () => {
  const testCompareJSON = `${path.join(
    process.cwd() + '/test/fixtures/tracerbench_output/compare.json',
  )}`;
  test
    .stdout()
    .it(
      `runs create-output-artifact --inputFilePath=${testCompareJSON}`,
      async ctx => {
        await Report.run([
          '--inputFilePath',
          testCompareJSON
        ]);

        chai.expect(ctx.stdout).to.contain(`Success asdasdfasdf`);
      },
    );
});