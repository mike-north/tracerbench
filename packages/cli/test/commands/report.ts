import { test } from '@oclif/test';
import * as chai from 'chai';
import * as path from 'path';
import Report from '../../src/commands/report';
import { tmpDir } from '../setup';

const tbResultsFolder = path.join(`${process.cwd()}/${tmpDir}/compare.json`);

describe('create-output-artifact: creates html', () => {
  test
    .stdout()
    .it(
      `runs create-output-artifact --inputFilePath ${tbResultsFolder}`,
      async ctx => {
        await Report.run([
          '--inputFilePath',
          tbResultsFolder
        ]);

        chai.expect(ctx.stdout).to.contain(`Written files out at `);
      },
    );
});