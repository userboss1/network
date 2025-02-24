var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const db = require('./config/connection')
var indexRouter = require('./routes/Guest1');
var usersRouter = require('./routes/Admin');
var superadminRouter=require('./routes/superadmin')
const session=require('express-session')
var app = express();
var fileUpload=require('express-fileupload')
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(fileUpload());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({secret:"key",cookie:{maxAge:60000}}))
app.use('/', indexRouter);
app.use('/admin', usersRouter);
app.use('/superadmin',superadminRouter)
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});
db.connect((err)=>{
  if(err)console.log('database connection error'+err)
  else console.log('database connection succesful')  
  })
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
