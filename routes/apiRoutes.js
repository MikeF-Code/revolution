var db = require("../models");
var passport = require("../config/passport.js");

module.exports = function(app) {
  // Login route with passport.js
  app.post("/login", passport.authenticate("local"), function(req, res) {
    socket.emit("changeName", { username: req.user.username });
    res.redirect("/");
  });

  // Register new user
  app.post("/register/new", function(req, res) {
    console.log("req.body is: ");
    console.log(req.body);
    console.log("--------------");
    db.Users.create({
      username: req.body.usernameRegister,
      password: req.body.passwordRegister,
      email: req.body.emailRegister
    }).then(function(results) {
      res.redirect("/");
    });
  });
};
