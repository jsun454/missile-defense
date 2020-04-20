let config = {
    type: Phaser.AUTO, //chooses the render type (WebGL or Canvas, if browser supports WebGL will use WebGL, otherwise Canvas)
    parent: 'phaser-example', //renders the game in an existing <canvas> element with 'phaser-example' if it exists, otherwise creates it
    width: 800, //screen width/height
    height: 600,
    physics: {
        default: 'arcade', //Phaser stuff
        arcade: {
            debug: false,
            gravity: { y: 0 } //0 gravity
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

let game = new Phaser.Game(config);

function preload() {
    this.load.image('ship', '/assets/spaceShips_001.png')
    this.load.image('otherPlayer', 'assets/enemyBlack5.png')
    this.load.image('star', 'assets/star_gold.png')
}

function create() {
    let self = this;
    this.socket = io();
    this.otherPlayers = this.physics.add.group(); //Create group to manage other players, makes collision way easier
    this.socket.on('currentPlayers', function (players) { //Listens for currentPlayers event, executes function when triggered
        //Creates an array from the players object that was passed in from the event in server.js
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === self.socket.id) {
                addPlayer(self, players[id]); //pass current player info and reference to current scene
            } else {
                addOtherPlayers(self, players[id]);
            }
        })
    })
    this.socket.on('newPlayer', function (playerInfo) {
        addOtherPlayers(self, playerInfo); //adds new player to the game
    })
    this.socket.on('disconnect', function (playerId) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) { //getChildren() returns all members of a group in an array
            if (playerId === otherPlayer.playerId) { //Removes the game object from the game
                otherPlayer.destroy();
            }
        })
    })
    this.cursors = this.input.keyboard.createCursorKeys(); //cursors object has 4 main Key objects
    this.socket.on('playerMoved', function (playerInfo) {
        self.otherPlayers.getChildren().forEach(function (otherPlayer) {
            if (playerInfo.playerId === otherPlayer.playerId) {
                otherPlayer.setRotation(playerInfo.rotation);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        })
    })

    this.blueScoreText = this.add.text(16, 16, '', { fontSize: '32px', fill: '#0000FF' });
    this.redScoreText = this.add.text(584, 16, '', { fontSize: '32px', fill: '#FF0000' });

    this.socket.on('scoreUpdate', function (scores) {
        self.blueScoreText.setText('Blue: ' + scores.blue);
        self.redScoreText.setText('Red: ' + scores.red);
    });
    this.socket.on('starLocation', function(starLocation) {
        if(self.star) {
            self.star.destroy(); //if a current star exists, destroy it
        }
        self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');
        self.physics.add.overlap(self.ship, self.star, function() {
            this.socket.emit('starCollected'); //if the current ship and the star overlaps, then it emits an event
        }, null, self)
    })
}


function update() {
    if (this.ship) {

        let mvtAngle = Math.atan2(this.input.activePointer.y - this.ship.y, this.input.activePointer.x - this.ship.x);
        let diffAngle = mvtAngle - (this.ship.rotation - Math.PI*0.5);
        if (diffAngle > Math.PI){
            diffAngle -= Math.PI*2.0;
        }
        if (diffAngle < -Math.PI){
            diffAngle += Math.PI*2.0;
        }
        this.ship.setAngularVelocity(600*diffAngle);


        
        //console.log(this.ship.rotation);

        /*if (this.cursors.left.isDown) {
            this.ship.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.ship.setAngularVelocity(150);
        } else {
            this.ship.setAngularVelocity(0);
        }
        if (this.cursors.up.isDown) {
            this.physics.velocityFromRotation(this.ship.rotation + 1.5, -100, this.ship.body.acceleration);
        } else {
            this.ship.setAcceleration(0);
        }*/

        this.physics.world.wrap(this.ship, 5); //ships that go off the side appear on the other side

        let x = this.ship.x;
        let y = this.ship.y;
        let r = this.ship.rotation;
        if (this.ship.oldPosition && (x !== this.ship.oldPosition.x || y !== this.ship.oldPosition.y
            || r !== this.ship.oldPosition.rotation)) { //If an oldPosition exists and the current ship has changed state
            this.socket.emit('playerMovement', { //Emits an event called playerMovement containing info about the current ship state
                x: this.ship.x,
                y: this.ship.y,
                rotation: this.ship.rotation
            })
        }

        this.ship.oldPosition = { //Makes the current ship position an old one
            x: this.ship.x,
            y: this.ship.y,
            rotation: this.ship.rotation
        }
    }
}

function addPlayer(self, playerInfo) {
    //adds the ship w/ arcade physics
    self.ship = self.physics.add.image(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
    if (playerInfo.team === 'blue') {
        self.ship.setTint(0x0000ff);
    } else {
        self.ship.setTint(0xff0000);
    }
    self.ship.setDrag(100); //resistance the object will face when moving
    self.ship.setAngularDrag(100);
    self.ship.setMaxVelocity(200); //max speed
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
    if (playerInfo.team === 'blue') {
        otherPlayer.setTint(0x0000ff);
    } else {
        otherPlayer.setTint(0xff0000);
    }
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer); //adds the player to the list
}