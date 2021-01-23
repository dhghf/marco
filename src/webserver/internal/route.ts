import { Router } from 'express-serve-static-core';
import Main from '../../Main';

export default class Route {
  protected router: Router;

  protected main: Main;

  constructor(main: Main, router: Router) {
    this.main = main;
    this.router = router;
  }

  public getRouter(): Router {
    return this.router;
  }
}
