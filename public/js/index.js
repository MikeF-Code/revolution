var userId;
var username;
var gameId;

$(function() {
  // Variable Declarations
    var usernamePrefixArray = adjectives;
    var usernameSuffixArray = animals;
    var isConnected = false;
    var socket = io();
    var messageList = $("#messageList");
    var nominationsRequired;
    var nominees = [];

  // Materialize initializations
    $('.chips').chips();

  // initial jQuery
    // $("#teamMembers").hide();

  // Functions
    // Display updated player count on connect/disconnect.
    var userCount = function(data) {
        var countMessage = "";
        if (data.userCount === 1) {
            countMessage = "1 revolutionary is currently active.";
        } else {
            countMessage = "" + data.userCount + " revolutionaries are currently active.";
        }
        chatUpdate(countMessage);
    };

    // Set randomly generated username.
    var setUsername = function() {
        if (username === undefined) {
            var usernamePrefix = usernamePrefixArray[Math.floor(Math.random() * usernamePrefixArray.length)];
            var usernameSuffix = usernameSuffixArray[Math.floor(Math.random() * usernameSuffixArray.length)];
            username = usernamePrefix + " " + usernameSuffix;
            $("#memberYou").text(username);
            // username = "Gray Fox";
        };
        socket.emit("add user", username);
    };
    setUsername();

    // Allow user to set their own username.
    var updateUsername = function() {
        $("#usernameInputSubmit").on("click", function(event) {
            event.preventDefault();
            username = $("#usernameInput").val().trim();
            socket.emit("update username", username);
        });
    };
    updateUsername();

    // Grab text of chat input, clean it, then emit the "chat message" socket.io event to the backend and pass username/message.
    var chatMessage = function() {
        var message = $("#message").val().trim();
        message = cleanInput(message);
        var room = $("#message").attr("data-room");
        var messageObj = {
            message: message,
            room: room
        };
        if (message && isConnected) {
            $("#message").val("");
            sendMessage({
                username: username,
                message: message
            });
            socket.emit("chat message", messageObj);
        }
    }

    // Send system messages to the chat.
    var chatUpdate = function(message, options) {
        var addMessage = $("<li>").addClass("update").text(message);
        postMessage(addMessage, options);
    }

    // Stick username and text of message into span elements, then append those to a <li> element to be staged for posting into chat.
    var sendMessage = function(data, options) {
        var usernameDiv = $("<span class='username'/>").text(data.username + ":").css("color", "#355F73");
        var messageTextDiv = $("<span class='messageText'/>").text(" " + data.message);
        var messageDiv = $("<li class='message'/>").data("username", data.username).append(usernameDiv, messageTextDiv);
        postMessage(messageDiv, options);
    }

    // Post message into chat window, and scroll chat upward.
    var postMessage = function(element, options) {
        if (!options) {
            options = {};
        }
        if (typeof options.prepend === "undefined") {
            options.prepend = false;
        }
        if (options.prepend) {
            messageList.prepend(element);
        } else {
            messageList.append(element);
        }
        messageList[0].scrollTop = messageList[0].scrollHeight;
    }

    // Clean chat message input into html.
    var cleanInput = function(input) {
        return $("<div/>").text(input).html();
    }

    // Randomly select a user's color for chatting purposes.
    var usernameColor = function(username) {
        var colors = ["#332288", "#117733", "#44AA99", "#88CCEE", "#DDCC77", "#CC6677", "#AA4499", "#882255", "#000000", "#ABABAB"];
        var colorSelect = colors[Math.floor(Math.random() * colors.length)];
        return colorSelect;
    }

    // Perform chatMessage() function as defined above when user presses the Enter key AND there is text in the input field.  This prevents the sending of empty messages.
    $(window).keydown(function(event) {
        if(event.which === 13 && $("#message").val().length > 0) {
            chatMessage();
        }
    });

    // Click event for the "Create Strike Team" button to make a new game room.
    $("#createGameButton").on("click", function(event) {
        event.preventDefault();
        socket.emit("create game");
    });

    // Click event for Game chips to join a game
    $("#gameList").on("click", ".gameChip", function(event) {
        event.preventDefault();
        var gameId = $(this).attr("data-gameid");
        var gameNum = $(this).children("#gameNum").text();
        parseInt(gameNum);
        var joinGameObject = {
            gameId: gameId,
            gameNum: gameNum
        };
        socket.emit("join game", joinGameObject)
    });

    // Click event for "Launch Strike Team" button to start gameplay.
    $("#gameUI").on("click", "#launchGameButton", function(event) {
        event.preventDefault();
        var gameId = $("#message").attr("data-room");
        var gameInfo = {
            gameId: gameId
        }
        socket.emit("game start", gameInfo);
        socket.emit("nominations", gameInfo);
    });




  // Socket.io client functions - these listen for events emitted by the backend server and executes functions as defined above.
    //
    socket.on("debug", function(data) {
        $("#debugID").text(data.id);
        userId = data.id;
        if (data.id == $("#debugID").text() && data.games.length > 0) {
            for (var i = 0; i < data.games.length; i++) {
                var gameList = $("#gameList");
                var gameListElement = $("<div>");
                gameListElement.addClass("chip gameChip");
                console.log("data.games[i] is:");
                console.log(data.games[i]);
                gameListElement.attr("data-gameId", data.games[i].gameId);
                gameListElement.html("<i class='material-icons right'>person_add</i>Game <span id='gameNum'>" + (i + 1) + "</span>")
                gameList.append(gameListElement);
            }
        }
    });

    // "login" event - flags user as being connected for use in internal logic, and displays a welcome message.  Also displays the current userCount as a message to all connected users.
    socket.on("login", function(data) {
        isConnected = true;
        var welcome = "Welcome to The Revolution, Comrade " + username;
        chatUpdate(welcome, {
            prepend: true
        });
        userCount(data);
    });

    // "chat message" event - passes text input to the sendMessage() function for staging and posting to the chat window.
    socket.on("chat message", function(data) {
        sendMessage(data);
    });

    // "user joined" event - broadcasts (displays for all OTHER connected sessions) when a user logs in, and displays current userCount.
    socket.on("user joined", function(data) {
        chatUpdate(data.username + " joined The Revolution!");
        userCount(data);
    });

    // "user left" event - same as above, but with a different message.
    socket.on("user left", function(data) {
        chatUpdate(data.username + " abandoned the cause!");
        userCount(data);
    });

    // "full game" event - notifies user when a selected game lobby is full.
    socket.on("full game", function(data) {
        if (data.userId == $("#debugID").text()) {
            chatUpdate("That Strike Team is currently full.");
        }
    });

    socket.on("already in game", function(data) {
        if (data.userId == $("#debugID").text()) {
            chatUpdate("You are already in a game!");
        }
    })

    // "game created" event - shows connected sessions the game on the game list
    socket.on("game created", function(data) {
        gameId = data.gameId;
        // Programatically generate the Game X chips listed on the Game List
        var gameListElement = $("<div>");
        gameListElement.addClass("chip gameChip");
        gameListElement.attr("data-gameId", data.gameId);" + "
        gameListElement.html("<i class='material-icons right'>person_add</i>Game <span id='gameNum'>" + data.gameNum + "</span>")
        $("#gameList").append(gameListElement);
        // End of Game X chip generation
        if (data.userId == $("#debugID").text()) {
            // Hide the "Create Strike Team" button once you're in a game
            $("#createGameButton").hide();
            // Change message input to direct messages to the Game-specific lobby.
            $("#message").attr("data-room", data.gameId);
            $("#roomName").text("Game " + data.gameNum);
            $("#games").hide();
            $("#teamMembers").show();
            var memberListElement = $("<div>");
            memberListElement.addClass("chip memberChip");
            memberListElement.attr("data-memberId", data.userId);
            memberListElement.text(data.username);
            $("#memberYou").append(memberListElement);
            var launchGameButton = $("<p>").html('<button class="waves-effect waves-light btn red darken-4 disabled" id="launchGameButton"><i class="material-icons left">priority_high</i>Launch Strike Team</button>');
            $("#gameUI").prepend(launchGameButton);
        }
        chatUpdate(data.username + " has joined Strike Team " + data.gameNum);
    });

    // "game joined" event - updates chat input and hides Create Strike Team button
    socket.on("game joined", function(data) {
        if (data.userId == $("#debugID").text()) {
            $("#createGameButton").hide();
            $("#message").attr("data-room", data.gameId);
            gameID = data.gameId;
            $("#roomName").text("Game " + data.gameNum);
            $("#games").hide();
            $("#teamMembers").show();
            for (var i = 0; i < data.playerList.length; i++) {
                var memberListElement = $("<div>");
                memberListElement.addClass("chip memberChip");
                memberListElement.attr("data-memberId", data.playerList[i].id);
                if (data.playerList[i].id == $("#debugID").text()) {
                    memberListElement.addClass("currentPlayer");
                    memberListElement.text(data.playerList[i].username);
                    $("#memberYou").append(memberListElement);
                } else if (data.playerList[i].id != $("#debugID").text()) {
                    memberListElement.html("<i class='material-icons left'>record_voice_over</i><span>" + data.playerList[i].username + "</span>");
                    $("#teamMembers").append(memberListElement);
                }
            }
        } else {
            var memberListElement = $("<div>");
            memberListElement.addClass("chip memberChip");
            memberListElement.attr("data-memberId", data.userId);
            memberListElement.html("<i class='material-icons left'>record_voice_over</i><span>" + data.username + "</span>");
            $("#teamMembers").append(memberListElement);
        }
    });

    // "disconnect" event - the disconnect event is reserved by socket.io - this informs the UI that their browser is disconnected from the server.
    socket.on("disconnect", function() {
        chatUpdate("You have been disconnected from the server.");
    })

    socket.on("game ready", function(data) {
        $("#launchGameButton").removeClass("disabled");
    });

    socket.on("game start", function(data) {
        $("#launchGameButton").hide();
        var leaderID = data.leaderID;
        $(".memberChip[data-memberId='"+leaderID+"']").addClass("blue");
        $(".memberChip[data-memberId='"+leaderID+"']").attr("id", "leaderChip");
        chatUpdate("Strike Team is a go!");
        var gameInfo = {
            leader: data.leader,
            playerList: data.playerList
        };
    });

    socket.on("other game started", function(data){
        $(".gameChip[data-gameid='"+data+"']").remove();
    });

    socket.on("spy check", function(data) {
        chatUpdate("*****You are a spy! Your fellow spies' names are written in Red text.*****");
        for (var i = 0; i < data.length; i++) {
            $(".memberChip[data-memberId='"+data[i].id+"']").addClass("red-text text-darken-3");
        }
    });

    socket.on("nominations", function(data) {
        chatUpdate(data.leader.username + " is the current Leader. " + data.leader.username + " is currently nominating a mission team.");
        // Construct Nomination UI for leader
        $("#gameUI").empty();
        $("#gameUI").off("click", "**");
        var nominationsUI = $("<div>");
        nominationsUI.attr("id", "nominationsUI");
        var headerText = $("<h5>");
        headerText.addClass("center-align");
        headerText.text("Nominate Mission Team");
        nominationsUI.append(headerText);
        for (var i = 0; i < data.playerList.length; i++) {
            var memberListElement = $("<div>");
            memberListElement.addClass("chip nomineeChip");
            memberListElement.attr("data-memberId", data.playerList[i].id);
            memberListElement.html("<i class='material-icons left'>check_box</i><span>" + data.playerList[i].username + "</span>");
            nominationsUI.append(memberListElement);
        }
        nominationsRequired = data.nominationCount;
        var submitNominations = $("<p>");
        var submitNominationsButton = $("<div>");
        submitNominationsButton.addClass("center-align");
        submitNominationsButton.html('<button class="waves-effect waves-light btn blue darken-4 disabled" id="submitNominationsButton"><i class="material-icons left">priority_high</i>Propose Mission Team</button>');
        submitNominations.append(submitNominationsButton);
        nominationsUI.append(submitNominations);
        $("#gameUI").append(nominationsUI);

        // Click event for Nomination selections and submission.
        $("#gameUI").on("click", ".nomineeChip", function(event) {
            event.preventDefault();
            if ($(this).hasClass("nomineeChipSelected")) {
                $(this).removeClass("nomineeChipSelected blue lighten-2");
                var nominee = $(this).attr("data-memberid");
                var nomineeIndex = nominees.indexOf(nominee);
                nominees.splice(nomineeIndex, 1);
                if ($(".nomineeChipSelected").length < nominationsRequired && $("#submitNominationsButton").hasClass("disabled") === false) {
                    $("#submitNominationsButton").addClass("disabled");
                }
            } else if ($(".nomineeChipSelected").length < nominationsRequired) {
                $(this).addClass("nomineeChipSelected blue lighten-2");
                var nominee = $(this).attr("data-memberid");
                nominees.push(nominee);
                console.log("Inside of 'less than nominationsRequired', value of 'nominationsRequired' is: " + nominationsRequired);
                if ($(".nomineeChipSelected").length == nominationsRequired) {
                    $("#submitNominationsButton").removeClass("disabled");
                }
            } else if ($(".nomineeChipSelected").length >= nominationsRequired){
                chatUpdate("SYSTEM MESSAGE: Maximum number of team members selected for this mission.");
            }
        });

        // Click event for submitting team nominations
        $("#gameUI").on("click", "#submitNominationsButton", function() {
            var nomineeData = {
                nomineeIDs: nominees,
                gameId: gameId
            }
            socket.emit("nominees selected", nomineeData);
        });
    });

    socket.on("team vote", function(data) {
        console.log("team vote");
        console.log("Proposed Mission Team:");
        console.log(data.missionTeam);
        console.log("Number of players: " + data.numPlayers);

        $("#gameUI").empty();
        chatMessage("Mission Team has been nominated.  Please discuss and vote when ready.");
        var teamVoteUI = $("<div>");
        teamVoteUI.attr("id", "teamVoteUI");
        var headerText = $("<h5>");
        headerText.addClass("center-align");
        headerText.text("Approve / Reject Mission Team");
        teamVoteUI.append(headerText);
        for (var i = 0; i < data.missionTeam.length; i++) {
            var memberListElement = $("<div>");
            memberListElement.addClass("chip missionTeamChip");
            memberListElement.attr("data-memberId", data.missionTeam[i].id);
            memberListElement.html("<i class='material-icons left'>check_box</i><span>" + data.missionTeam[i].username + "</span>");
            teamVoteUI.append(memberListElement);
        }
        var voteRow = $("<div>");
        voteRow.addClass("row");
        voteRow.attr("id", "teamVoteButtons");
        var approveColumn = $("<div>");
        approveColumn.addClass("col l6 center-align");
        approveColumn.html('<button class="waves-effect waves-light btn blue darken-4 teamVoteButton" id="approveMissionTeamButton"><i class="material-icons left">thumb_up</i>Approve</button>');
        voteRow.append(approveColumn);
        var denyColumn = $("<div>");
        denyColumn.addClass("col l6 center-align");
        denyColumn.html('<button class="waves-effect waves-light btn red darken-4 teamVoteButton" id="denyMissionTeamButton"><i class="material-icons left">thumb_down</i>Reject</button>');
        voteRow.append(denyColumn);
        teamVoteUI.append(voteRow);
        $("#gameUI").append(teamVoteUI);

        // Click event to tally vote
        $("#gameUI").on("click", ".teamVoteButton", function(event) {
            event.preventDefault();
            $(".teamVoteButton").addClass("disabled");
            var waitForTeamMessage = $("<p>");
            waitForTeamMessage.addClass("center-align");
            waitForTeamMessage.text("Vote submitted.  Please wait for your Strike Team to finish voting.");
            teamVoteUI.append(waitForTeamMessage);
            if ($(this).attr("id") == "approveMissionTeamButton") {
                var voteInfo = {
                    voterId: userId,
                    approve: true,
                    gameId: gameId,
                    missionTeam: data.missionTeam
                };
                socket.emit("nominees voted", voteInfo);
            } else if ($(this).attr("id") == "denyMissionTeamButton") {
                var voteInfo = {
                    voterId: userId,
                    approve: false,
                    gameId: gameId,
                    missionTeam: data.missionTeam
                };
                socket.emit("nominees voted", voteInfo);
            }
        })
    });

    socket.on("vote passed", function(data) {
        console.log("Vote passed");
        console.log("Mission Team Members now voting to Pass or Fail the mission.");
        $("#gameUI").empty();
        $("#gameUI").off("click", "**");
    });

    socket.on("vote failed", function(data) {
        console.log("Vote failed.");
        $("#gameUI").empty();
        $("#gameUI").off("click", "**");
        $("#leaderChip").removeClass("blue");
        $(".memberChip[id='leaderChip']").removeAttr("id");
        $(".memberChip[data-memberId='"+data.leader.id+"']").addClass("blue");
        $(".memberChip[data-memberId='"+data.leader.id+"']").attr("id", "leaderChip");
        console.log("New leader is assigned and a new Mission Team is being nominated.");
        console.log("This is vote " + data.votingRound + " out of 5.  If vote 5 fails, the Spies win!");
    });

    socket.on("mission vote", function(data) {
        // Generate Mission Pass/Fail Buttons for Mission Team
        console.log("You are a Member of the Mission Team.  Please vote for the outcome of the mission.");
        var missionVoteUI = $("<div>");
        missionVoteUI.attr("id", "teamVoteUI");
        var headerText = $("<h5>");
        headerText.addClass("center-align");
        headerText.text("Mission Outcome");
        missionVoteUI.append(headerText);
        var voteRow = $("<div>");
        voteRow.addClass("row");
        voteRow.attr("id", "missionVoteButtons");
        var approveColumn = $("<div>");
        approveColumn.addClass("col l6 center-align");
        approveColumn.html('<button class="waves-effect waves-light btn blue darken-4 missionVoteButton" id="approveMissionTeamButton"><i class="material-icons left">check_circle</i>Success</button>');
        voteRow.append(approveColumn);
        var denyColumn = $("<div>");
        denyColumn.addClass("col l6 center-align");
        denyColumn.html('<button class="waves-effect waves-light btn red darken-4 missionVoteButton" id="denyMissionTeamButton"><i class="material-icons left">cancel</i>Fail</button>');
        voteRow.append(denyColumn);
        missionVoteUI.append(voteRow);
        $("#gameUI").append(missionVoteUI);
        var currentPlayer = data.missionTeam.find(function(player) {
            return player.id === userId;
        });
        console.log("currentPlayer is: ");
        console.log(currentPlayer);
        console.log("---------------");

        // Click event for Pass/Fail Buttons
        $("#gameUI").on("click", ".missionVoteButton", function(event) {
            event.preventDefault();
            var waitForTeamMessage = $("<p>");
            waitForTeamMessage.addClass("center-align");
            waitForTeamMessage.attr("id", "voteMessage");
            // waitForTeamMessage.text("Vote submitted.  Please wait for the rest of the Mission Team to finish voting.");
            $("#teamVoteUI").append(waitForTeamMessage);
            if ($(this).attr("id") == "approveMissionTeamButton") {
                var voteInfo = {
                    voterId: userId,
                    fail: false,
                    gameId: gameId,
                };
                $(".missionVoteButton").addClass("disabled");
                socket.emit("mission team voted", voteInfo);
            } else if ($(this).attr("id") == "denyMissionTeamButton" && currentPlayer.isSpy === true) {
                var voteInfo = {
                    voterId: userId,
                    fail: true,
                    gameId: gameId,
                };
                $(".missionVoteButton").addClass("disabled");
                socket.emit("mission team voted", voteInfo);
            } else if ($(this).attr("id") == "denyMissionTeamButton" && currentPlayer.isSpy === false) {
                $("#voteMessage").text("Loyal members of The Revolution cannot Fail missions!");
            };
        });
    });

    socket.on("mission results", function(data) {
        $("#gameUI").empty();
        $("#gameUI").off("click", "**");
        $("#leaderChip").removeClass("blue");
        $(".memberChip[id='leaderChip']").removeAttr("id");
        $(".memberChip[data-memberId='"+data.leader.id+"']").addClass("blue");
        $(".memberChip[data-memberId='"+data.leader.id+"']").attr("id", "leaderChip");
        if (data.failVotes > 0) {
            if (data.currentRound === 4 && data.twoFailsNeeded === true && data.failVotes > 1) {
                console.log("Round 4: 2+ fails required.  " + data.failVotes + " fails were submitted.  Mission failed.");
                console.log("Current score: ");
                console.log("Successful Missions: " + data.goodGuysScore);
                console.log("Failed Missions: " + data.badGuysScore);
            } else if (data.currentRound === 4 && data.twoFailsNeeded === true && data.failVotes <=1){
                console.log("Round 4: 2+ fails required.  " + data.failVotes + " fails were submitted.  Mission successful.");
                console.log("Current score: ");
                console.log("Successful Missions: " + data.goodGuysScore);
                console.log("Failed Missions: " + data.badGuysScore);
            }
            console.log(data.failVotes + " fails were submitted.  Mission failed.");
            console.log("Current score: ");
            console.log("Successful Missions: " + data.goodGuysScore);
            console.log("Failed Missions: " + data.badGuysScore);
        } else {
            console.log(data.failVotes + " fails were submitted.  Mission successful.");
            console.log("Current score: ");
            console.log("Successful Missions: " + data.goodGuysScore);
            console.log("Failed Missions: " + data.badGuysScore);
        }
    });

    socket.on("game over", function(data) {
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
        console.log("Game over.");
        $("#gameUI").empty();
        $("#gameUI").off("click", "**");
        if (data.spiesWin === true) {
            console.log("The Strike Team is disbanded by failure and distrust! Spies win!");
        } else if (data.spiesWin === false) {
            console.log("The Revolution stands strong in the face of betrayal, and the Strike Team wins!");
        };
        console.log("The spies this game were: ");
        for (var i = 0; i < data.spies.length; i++) {
            console.log(data.spies[i].username);
        };
        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
    });

});