import process from "process";
import path from "path";
import bodyParser from "body-parser";
import session from "express-session";
import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";
import sassMiddleware from "node-sass-middleware";
import tildeImporter from "node-sass-tilde-importer";

import createPassport from "./passport";
import addRoutes from "./routes";
import configureHandlebars from "./handlebars";
import { getParticipant } from "./handlers";

export default function configureExpress(app, argv, idpOptions, spOptions) {
  const [ passport, strategy ] = createPassport(spOptions);
  const hbs = configureHandlebars();
  app.set('port', process.env.PORT || argv.port);
  app.set('views', path.join(process.cwd(), './views'));

  /**
   * View Engine
   */

  app.set('view engine', 'hbs');
  app.set('view options', { layout: 'layout' });
  app.engine('handlebars', hbs.__express);
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use(passport.initialize());

  /**
   * Middleware
   */

  app.use(logger(':date> :method :url - {:referrer} => :status (:response-time ms)', {
    skip: function (req, res)
    {
      return req.path.startsWith('/samlproxy/idp/bower_components') || req.path.startsWith('/samlproxy/idp/css');
    }
  }));
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(cookieParser());
  app.use(session({
    secret: 'The universe works on a math equation that never even ever really ends in the end',
    resave: false,
    saveUninitialized: true,
    name: 'idp_sid',
    cookie: { maxAge: 60000 }
  }));

  app.use(sassMiddleware({
    src: path.join(process.cwd(), "styles"),
    dest: path.join(process.cwd(), "public"),
    debug: true,
    importer: tildeImporter,
    outputStyle: 'expanded'
  }));

  app.use(function(req, res, next){
    req.user = argv.idpConfig.user;
    req.metadata = argv.idpConfig.metadata;
    req.passport = passport;
    req.strategy = strategy;
    req.sp = { options: spOptions };
    req.idp = { options: idpOptions };
    req.participant = getParticipant(req);
    next();
  });

  app.use(function(req, res, next){
    if (req.idp.options.rollSession) {
      req.session.regenerate(function(err) {
        return next();
      });
    } else {
      next();
    }
  });

  addRoutes(app, idpOptions, spOptions);

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    const err = new Error('Route Not Found');
    err.status = 404;
    next(err);
  });

  // development error handler
  app.use(function(err, req, res, next) {
    if (err) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    }
  });

  return app;
}


