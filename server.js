require("dotenv").config();
var express = require("express");
var exphbs = require("express-handlebars");
var userCount = 0;
var cookieParser = require("cookie-parser");

  // var db = require("./models");
  // var passport = require("./config/passport.js");

var session = require("express-session");

// SQL session store using Sequelize
  // var SequelizeStore = require("connect-session-sequelize")(session.Store);

  // function extendDefaultFields(defaults, session) {
  //   return {
  //     data: defaults.data,
  //     expires: defaults.expires,
  //     userId: session.userId
  //   };
  // }
  // var sessionStore = new SequelizeStore({
  //   db: db.sequelize,
  //   table: "Session",
  //   extendDefaultFields: extendDefaultFields
  // });
// End of SQL sessions store config

var app = express();
var http = require("http").Server(app);

var io = require("socket.io")(http);

var PORT = process.env.PORT || 3120;

var games = new function() {
  this.gameCount = 0,
  this.gameList = [],
  this.gamesLookingForPlayers = []
};

var users = [];


// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    proxy: true
  })
);
// app.use(passport.initialize());
// app.use(passport.session());

// Handlebars
app.engine(
  "handlebars",
  exphbs({
    defaultLayout: "main"
  })
);
app.set("view engine", "handlebars");

// Routes
require("./routes/apiRoutes")(app);
require("./routes/htmlRoutes")(app);

  // var syncOptions = { force: false };

// If running a test, set syncOptions.force to true
// clearing the `testdb`
  // if (process.env.NODE_ENV === "test") {
  //   syncOptions.force = true;
  // }

// Sync sessionStore
  // sessionStore.sync();

// Starting the server, syncing our models ------------------------------------/
  // db.sequelize.sync(syncOptions).then(function() {
http.listen(PORT, function() {
  console.log(
    "==> 🌎  Listening on port %s. Visit http://localhost:%s/ in your browser.",
    PORT,
    PORT
  );
});
// });

// Initialize socket.io connection
io.on('connection', function(socket) {

  // Set default value of addUser variable to false - will be set to true when a user connects and is added to the app
  var addUser = false;
  socket.join("lobby");
  console.log("Session " + socket.id + " initialized.");
  socket.emit("debug", {
    id: socket.id,
    rooms: socket.rooms,
    games: games.gamesLookingForPlayers
  });

  // 'chat message' event - emits message to client with username attached
  socket.on("chat message", function(data) {
      socket.broadcast.to(data.room).emit("chat message", {
          username: socket.username,
          message: data.message
      });
  });

  // 'add user' event - will assign username to socket session, and emit 'user joined' event to broadcast that said user has connected to the app
  socket.on("add user", function(username) {
      if (addUser) return;
      socket.username = username;
      userCount++;
      console.log("Current user count is " + userCount);
      addUser = true;
      var player = {
        username: username,
        id: socket.id,
        inGame: false,
        connected: true,
        isLeader: false,
        isSpy: false
      }
      users.push(player);
      socket.emit("login", {
          userCount: userCount
      });
      socket.broadcast.emit("user joined", {
          username: socket.username,
          userCount: userCount
      });
  });

  // 'update username' event - allows users to set their own username if they don't wish to use the randomly generated one automatically assigned
  socket.on("update username", function(username) {
      socket.username = username;
      socket.broadcast.emit("user joined", {
          username: socket.username,
          userCount: userCount
      });
  });

  socket.on("create game", function() {
    var gameId = (Math.random()+1).toString(36).slice(2, 18);
    var game = {gameId: gameId, gameData: {}};
    var playerIndex = users.map(function(id) {
      return id.id;})
      .indexOf(socket.id);
    var player = users[playerIndex];
    game.gameData.players = [];
    games.gameCount++;
    io.emit("game created", {
      username: socket.username,
      userId: socket.id,
      gameId: gameId,
      gameNum: games.gameCount
    });
    socket.join(gameId, function() {
      console.log("New room created with ID " + gameId + " by user " + socket.username);
      player.inGame = true;
      player.gameId = gameId;
      game.gameData.players.push(player);
      game.gameData.playercount = 1;
      game.gameData.isOpen = true;
      games.gameList.push(game);
      games.gamesLookingForPlayers.push(game);
    });
    socket.leave("lobby");
  });

  // data.gameId data.gameNum
  socket.on("join game", function(data) {
    var game = games.gameList[games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(data.gameId)];
    var player = users[users.map(function(id) {
      return id.id;})
      .indexOf(socket.id)];
    if (game.gameData.playercount <= 10 && game.gameData.isOpen === true) {
      if (player === undefined || player.inGame === false) {
        player.playerNum = game.gameData.players.length;
        player.gameId = game.gameId;
        player.inGame = true;
        game.gameData.players.push(player);
        game.gameData.playercount++;
        if (game.gameData.playercount == 10) {
          game.gameData.isOpen = false;
        }
        socket.join(data.gameId, function(){
          console.log("User " + socket.username + " has joined Game " + data.gameNum);
        });
        socket.emit("game joined", {
          userId: socket.id,
          gameId: data.gameId,
          gameNum: data.gameNum,
          username: socket.username,
          playerList: game.gameData.players
        });
        socket.to(data.gameId).emit("game joined", {
          userId: socket.id,
          gameId: data.gameId,
          gameNum: data.gameNum,
          username: socket.username,
          playerList: game.gameData.players
        });
        socket.leave("lobby");
      }
      if (game.gameData.players.length === 5) {
        socket.to(game.gameData.players[0].id).emit("game ready");
        console.log("5th player is joining game " + game.gameId + ".  Game is ready to start.");
      }
    } else if (player.inGame === true) {
      socket.emit("already in game", {
        userId: socket.id
      });
    } else {
      socket.emit("full game", {
        userId: socket.id
      });
    }
  });

  // 'disconnect' event - will decrement the userCount variable, and emit 'user left' event to broadcast that user has left the app
  socket.on("disconnect", function() {
      if (addUser) {
          var currentUser = users[users.map(function(id) {
            return id.id;})
            .indexOf(socket.id)];
          if (currentUser.inGame === true) {
            var currentGame = games.gameList[games.gameList.map(function(id) {
              return id.gameId;})
              .indexOf(currentUser.gameId)];
            var currentGameIndex = games.gameList.indexOf(currentGame);
            var currentGameUserIndex = currentGame.gameData.players.indexOf(currentUser);
            currentGame.gameData.players.splice(currentGameUserIndex, 1);
            currentGame.gameData.playercount--
            if (currentGame.gameData.playercount == 0) {
              if (currentGame.gameData.isOpen === true) {
                var openGameIndex = games.gamesLookingForPlayers.map(function(id) {
                  return id.gameId;})
                  .indexOf(currentUser.gameId)
                games.gamesLookingForPlayers.splice(openGameIndex, 1);
              };
              games.gameList.splice(currentGameIndex, 1);
            }
          }
          currentUser.connected = false;
          userCount--;
          console.log("User " + socket.id + " disconnected.  Current user count is " + userCount);
          socket.broadcast.emit("user left", {
              username: socket.username,
              userCount: userCount
          });
      }
  });

  ////////////////////////////////////////////////////////////////////////////////////////////////////
  //                                                                                                //
  //                                                                                                //
  //                                                                                                //
  //                                      GAME LOGIC                                                //
  //                                                                                                //
  //                                                                                                //
  //                                                                                                //
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  socket.on("game start", function(data) {
    var gameId = data.gameId;
    var gameIndex = games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(gameId);
    var game = games.gameList[gameIndex];
    var openGameIndex = games.gamesLookingForPlayers.map(function(id) {
      return id.gameId;})
      .indexOf(gameId);
    games.gamesLookingForPlayers.splice(openGameIndex, 1);
    game.gameData.isOpen = false;
    switch (game.gameData.playercount) {
      case 5:
        game.gameData.gameRules = {
          numSpies: 2,
          roundPlayers: {
            '1': 2,
            '2': 3,
            '3': 2,
            '4': 3,
            '5': 3
          },
          round4TwoFails: false
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
      case 6:
        game.gameData.gameRules = {
          numSpies: 2,
          roundPlayers: {
            '1': 2,
            '2': 3,
            '3': 4,
            '4': 3,
            '5': 4
          },
          round4TwoFails: false
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
      case 7:
        game.gameData.gameRules = {
          numSpies: 3,
          roundPlayers: {
            '1': 2,
            '2': 3,
            '3': 3,
            '4': 4,
            '5': 4
          },
          round4TwoFails: true
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
      case 8:
        game.gameData.gameRules = {
          numSpies: 3,
          roundPlayers: {
            '1': 3,
            '2': 4,
            '3': 4,
            '4': 5,
            '5': 5
          },
          round4TwoFails: true
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
      case 9:
        game.gameData.gameRules = {
          numSpies: 3,
          roundPlayers: {
            '1': 3,
            '2': 4,
            '3': 4,
            '4': 5,
            '5': 5
          },
          round4TwoFails: true
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
      case 10:
        game.gameData.gameRules = {
          numSpies: 4,
          roundPlayers: {
            '1': 3,
            '2': 4,
            '3': 4,
            '4': 5,
            '5': 5
          },
          round4TwoFails: true
        };
        game.gameData.currentRound = 1;
        game.gameData.currentRoundStats = {
          voteRounds: 1,
          approveVotes: 0,
          denyVotes: 0,
          teamVoteCount: 0,
          passVotes: 0,
          failVotes: 0,
          missionVoteCount: 0
        };
        game.gameData.voters = [];
        game.gameData.successMissions = 0;
        game.gameData.failMissions = 0;
        break;
    };
    var leader = game.gameData.players[Math.floor(Math.random() * game.gameData.players.length)];
    leader.isLeader = true;
    console.log("Current Leader:");
    console.log(leader);
    game.gameData.spies = [];
    var spyIndex = -1;
    var spyCount = 0;
    while (spyCount < game.gameData.gameRules.numSpies) {
      spyCount++;
      spyIndex = Math.floor(Math.random() * game.gameData.players.length);
      if (game.gameData.players[spyIndex].isSpy === false) {
        game.gameData.players[spyIndex].isSpy = true;
        game.gameData.spies.push(game.gameData.players[spyIndex]);
      } else {
        spyCount--;
        continue;
      }
    };
    var spies = game.gameData.spies;
    for (var i = 0; i < game.gameData.spies.length; i++) {
      io.in(spies[i].id).emit("spy check", spies);
    };
    var gameInfo = {
      leader: leader,
      leaderID: leader.id,
      leaderName: leader.username,
      playerList: game.gameData.players
    };
    io.in(gameId).emit("game start", gameInfo);
    io.in("lobby").emit("other game started", gameId);
   });

   socket.on("nominations", function(data) {
    var gameIndex = games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(data.gameId);
    var game = games.gameList[gameIndex];
    var currentLeader = game.gameData.players[game.gameData.players.map(function(id) {
      return id.isLeader;})
      .indexOf(true)];
    var gameInfo = {
      leader: currentLeader,
      playerList: game.gameData.players,
      nominationCount: game.gameData.gameRules.roundPlayers[game.gameData.currentRound]
    };
    io.in(currentLeader.id).emit("nominations", gameInfo);
   });

   socket.on("nominees selected", function(data) {
    var gameIndex = games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(data.gameId);
    var game = games.gameList[gameIndex];
    var missionTeam =  data.nomineeIDs.map(function(playerID) {
      var nomineeObject = game.gameData.players.find(function(player) {
        return player.id === playerID;
      });
      return nomineeObject;
    });
    var nominatedTeam = {
      missionTeam: missionTeam,
      numPlayers: game.gameData.players.length
    }
    io.in(data.gameId).emit("team vote", nominatedTeam);
    console.log("Game " + data.gameId + " has submitted nominations for Mission " + game.gameData.currentRound + ".  Approve/Reject vote started.");
   });

   socket.on("nominees voted", function(data) {
    var gameIndex = games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(data.gameId);
    var game = games.gameList[gameIndex];
    var voterId = data.voterId;
    var playerIndex = game.gameData.players.map(function(player) {
      return player.id;})
      .indexOf(voterId);
    var player = game.gameData.players[playerIndex];
    var voterInfo = {
      voterName: player.username,
      voterId: data.voterId,
      voteApproved: data.approve
    };
    game.gameData.voters.push(voterInfo);
    if (data.approve === true) {
      game.gameData.currentRoundStats.teamVoteCount++;
      game.gameData.currentRoundStats.approveVotes++;
    } else if (data.approve === false) {
      game.gameData.currentRoundStats.teamVoteCount++;
      game.gameData.currentRoundStats.denyVotes++;
    }
    if (game.gameData.currentRoundStats.teamVoteCount === game.gameData.players.length) {
      if (game.gameData.currentRoundStats.approveVotes > game.gameData.currentRoundStats.denyVotes) {
        var gameStatus = {
          voterList: game.gameData.voters
        };
        console.log("Mission team nominations vote passed in Game " + data.gameId);
        io.in(data.gameId).emit("vote passed", gameStatus);
        var missionStatus = {
          missionTeam: data.missionTeam
        };
        for (var i = 0; i < data.missionTeam.length; i++) {
          io.in(data.missionTeam[i].id).emit("mission vote", missionStatus);
        };
        game.gameData.currentRoundStats.voteRounds = 1;
        game.gameData.currentRoundStats.approveVotes = 0;
        game.gameData.currentRoundStats.denyVotes = 0;
        game.gameData.currentRoundStats.teamVoteCount = 0;
        game.gameData.voters = [];
      } else if (game.gameData.currentRoundStats.approveVotes <= game.gameData.currentRoundStats.denyVotes) {
        game.gameData.currentRoundStats.voteRounds++;
        var currentLeaderIndex = game.gameData.players.findIndex(function(player) {
          return player.isLeader === true;
        });
        var leader = game.gameData.players[currentLeaderIndex];
        game.gameData.players[currentLeaderIndex].isLeader = false;
        if (currentLeaderIndex === (game.gameData.players.length - 1)) {
          leader = game.gameData.players[0];
          game.gameData.players[0].isLeader = true;
        } else {
          leader = game.gameData.players[(currentLeaderIndex + 1)];
          game.gameData.players[(currentLeaderIndex + 1)].isLeader = true;
        }
        var gameStatus = {
          leader: leader,
          playerList: game.gameData.players,
          currentRound: game.gameData.currentRound,
          voterList: game.gameData.voters,
          votingRound: game.gameData.currentRoundStats.voteRounds,
          nominationCount: game.gameData.gameRules.roundPlayers[game.gameData.currentRound]
        }
        game.gameData.currentRoundStats.approveVotes = 0;
        game.gameData.currentRoundStats.teamVoteCount = 0;
        game.gameData.currentRoundStats.denyVotes = 0;
        game.gameData.voters = [];
        io.in(data.gameId).emit("vote failed", gameStatus);
        io.in(leader.id).emit("nominations", gameStatus);
      }
      if (game.gameData.currentRoundStats.voteRounds > 5) {
        var gameStatus = {
          spiesWin: true,
          spies: game.gameData.spies
        };
        io.in(data.gameId).emit("game over", gameStatus);
      }
    }
   });

   socket.on("mission team voted", function(data) {
    var gameIndex = games.gameList.map(function(id) {
      return id.gameId;})
      .indexOf(data.gameId);
    var game = games.gameList[gameIndex];
    var leader;

    var newRound = function() {
      var currentLeaderIndex = game.gameData.players.findIndex(function(player) {
        return player.isLeader === true;
      });
      game.gameData.players[currentLeaderIndex].isLeader = false;
      if (currentLeaderIndex === (game.gameData.players.length - 1)) {
        leader = game.gameData.players[0];
        game.gameData.players[0].isLeader = true;
      } else {
        leader = game.gameData.players[(currentLeaderIndex + 1)];
        game.gameData.players[(currentLeaderIndex + 1)].isLeader = true;
      }
      game.gameData.currentRound++;

      var gameStatus = {
        twoFailsNeeded: game.gameData.gameRules.round4TwoFails,
        leader: leader,
        playerList: game.gameData.players,
        currentRound: game.gameData.currentRound,
        nominationCount: game.gameData.gameRules.roundPlayers[game.gameData.currentRound],
        failVotes: game.gameData.currentRoundStats.failVotes,
        goodGuysScore: game.gameData.successMissions,
        badGuysScore: game.gameData.failMissions
      }
      io.in(data.gameId).emit("mission results", gameStatus);
      io.in(leader.id).emit("nominations", gameStatus);
      game.gameData.currentRoundStats.missionVoteCount = 0;
      game.gameData.currentRoundStats.failVotes = 0;
      game.gameData.currentRoundStats.passVotes = 0;
    }

    var gameOverCheck = function() {
      if (game.gameData.successMissions === 3) {
        var gameStatus = { 
          spiesWin: false,
          spies: game.gameData.spies
        };
        io.in(data.gameId).emit("game over", gameStatus);
      } else if (game.gameData.failMissions === 3) {
        var gameStatus = {
          spiesWin: true,
          spies: game.gameData.spies
        };
        io.in(data.gameId).emit("game over", gameStatus);
      } else {
        newRound();
      }
    };

    if (data.fail === true) {
      game.gameData.currentRoundStats.failVotes++;
      game.gameData.currentRoundStats.missionVoteCount++;
    } else if (data.fail === false) {
      game.gameData.currentRoundStats.passVotes++;
      game.gameData.currentRoundStats.missionVoteCount++;
    };
    if (game.gameData.currentRoundStats.missionVoteCount === game.gameData.gameRules.roundPlayers[game.gameData.currentRound]) {
      if (game.gameData.currentRound === 4 && game.gameData.gameRules.round4TwoFails === true) {
        if (game.gameData.currentRoundStats.failVotes >= 2) {
          console.log("Round 4: 2+ fails required.  " + game.gameData.currentRoundStats.failVotes + " fails were submitted.  Mission failed.");
          game.gameData.failMissions++;
          gameOverCheck();
        } else {
          console.log("Round 4: 2+ fails required.  " + game.gameData.currentRoundStats.failVotes + " fails were submitted.  Mission successful.");
          game.gameData.successMissions++;
          gameOverCheck();
        }
      } else if (game.gameData.currentRoundStats.failVotes > 0) {
          console.log(game.gameData.currentRoundStats.failVotes + " fails were submitted.  Mission failed.");
          game.gameData.failMissions++;
          gameOverCheck();
      } else {
          console.log(game.gameData.currentRoundStats.failVotes + " fails were submitted.  Mission successful.");
          game.gameData.successMissions++;
          gameOverCheck();
      };
    };
  });

});

module.exports = io;
module.exports = app;
