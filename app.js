var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const db = require('./config/connection')
var indexRouter = require('./routes/Guest1');
var usersRouter = require('./routes/Admin');
var superadminRouter = require('./routes/superadmin')
const session = require('express-session')
var fileUpload = require('express-fileupload')
var app = express();

// Handlebars helper registration
const hbs = require('hbs');  // Use 'hbs' instead of 'handlebars'
hbs.registerHelper('eq', function(a, b) {
    return a === b;
});
hbs.registerHelper('json', function(context) {
   return JSON.stringify(context);
});
app.set('env', 'development');
app.use((req, res, next) => {
   res.setHeader('Cache-Control', 'no-store');
   next();
 });
 
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(fileUpload());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
hbs.registerHelper('toJSON', hbs.handlebars.helpers.json);

app.use(session({
   secret: "your_secret_key",
   resave: false,
   saveUninitialized: true,
   cookie: {
       maxAge: 3 * 60 * 60 * 1000 // 1 hour in milliseconds
   }
}));


app.use('/', indexRouter);
app.use('/admin', usersRouter);
app.use('/superadmin', superadminRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
   next(createError(404));
});

db.connect((err) => {
   if(err) console.log('database connection error' + err)
   else console.log('database connection successful')
});
hbs.registerHelper('formatDate', function(date) {
  return new Date(date).toLocaleString();
});
// error handler
app.use(function(err, req, res, next) {
   // set locals, only providing error in development
   res.locals.message = err.message;
   res.locals.error = req.app.get('env') === 'development' ? err : {};
   
   // render the error page
   res.status(err.status || 500);
   res.render('error');
});

module.exports = app;