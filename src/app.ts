import { LogService } from 'matrix-bot-sdk';
import Main from './MainController';
import { Config } from './Config';
import RegManager from './matrix/internal/RegManager';

function init() {
  Config.genConfig();
  RegManager.genRegistration();
}

function start() {
  const mcBridge = new Main();

  mcBridge.start().catch(LogService.error);
}

function main() {
  if (process.argv.includes('--INIT')) {
    init();
  } else {
    start();
  }
}

main();
