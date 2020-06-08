/* Imports angle function for calculating barrel angle */
import { angle } from '/static/gameCalculations.js';

/* Imports text formatting */
import { formatTUT, formatBUT, formatMED } from '/static/textFormatting.js'

/* Scene that handles redrawing of the game and server-client interactions */
class GameScene extends Phaser.Scene {

    /* Defines the key identifier for the scene */
    constructor() {
        super({ key: "gameScene" });
    }

    /* Receives the socket to avoid mutliple socket creations */
    init(socket) {
        this.socket = socket;
    }

    /* Loads game assets */
    preload() {
        
        /* Background sprites */
        this.load.image('background', '/assets/background.png');
        this.load.image('base', '/assets/base.png');
        
        /* Player/game sprites */
        this.load.image('tankbody1', '/assets/tankbody1.png');
        this.load.image('tankbody2', '/assets/tankbody2.png');
        this.load.image('tankbody3', '/assets/tankbody3.png');
        this.load.image('tankbody4', '/assets/tankbody4.png');
        this.load.image('missile', '/assets/missile.png');
        this.load.image('crosshair', '/assets/crosshairs.png');
        this.load.image('flak', '/assets/flak-icon.png');
        this.load.image('nuke', '/assets/nuke-icon.png');

        /* UI Sprites */
        this.load.image('button', '/assets/button.png');
        this.load.image('halfbutton', '/assets/half-button.png');
        this.load.image('reloadmeter', '/assets/reload-meter-tex.png');
        this.load.image('shopbg', '/assets/shop-ui-main.png');
        this.load.image('specialholder', '/assets/special-attack-holder.png');
        this.load.image('info', '/assets/info.png');

        /* Spritesheets */
        this.load.spritesheet('tankbarrel', '/assets/tankbarrel.png', {
            frameWidth: 32,
            frameHeight: 256
        });
        this.load.spritesheet('comet', '/assets/comet.png', {
            frameWidth: 64,
            frameHeight: 128
        });
        this.load.spritesheet('nuke-projectile', '/assets/nuke-projectile.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        this.load.spritesheet('explosion', '/assets/explosion.png', {
            frameWidth: 128,
            frameHeight: 128
        });
        this.load.spritesheet('laser', 'assets/laser-bar.png', {
            frameWidth: 64,
            frameHeight: 64
        });
    }

    /* Code run on scene start */
    create() {
        
        /* Display background sprites */
        this.add.image(640, 360, 'background').setScale(1);
        this.add.image(640, 360, 'base').setScale(1);

        /* Creates animations */
        this.anims.create({
            key: 'explode',
            frameRate: 20,
            frames: this.anims.generateFrameNames('explosion', {
                start: 0,
                end: 15
            })
        });
        this.anims.create({
            key: 'cometRevolve',
            frameRate: 20,
            repeat: -1,
            frames: this.anims.generateFrameNames('comet', {
                start: 0,
                end: 15
            })
        });

        this.anims.create({
            key: 'fireShot',
            frameRate: 20,
            frames: this.anims.generateFrameNames('tankbarrel', {
                start: 1,
                end: 8
            })
        });
        this.anims.create({
            key: 'laserFlux',
            frameRate: 8,
            repeat: -1,
            frames: this.anims.generateFrameNames('laser', {
                start: 0,
                end: 2
            })
        });

        this.anims.create({
            key: 'nukeRevolve',
            frameRate: 20,
            repeat: -1,
            frames: this.anims.generateFrameNames('nuke-projectile', {
                start: 0,
                end: 15
            })
        });

         /* Focus data */
         this.pointerInGame = true
         this.game.canvas.onmouseover = () => this.pointerInGame = true
         this.game.canvas.onmouseout = () => this.pointerInGame = false
         this.focus = true;

        /* Object groups */
        this.missiles = this.physics.add.group();
        this.comets = this.physics.add.group();
        this.otherPlayers = this.physics.add.group();
        this.otherTankbodys = this.physics.add.group();
        this.crosshairs = this.physics.add.group();
        this.shopUI = this.add.group();

        /* Variables for button placement */
        this.shopUIButtonPlacerX = 80;
        this.shopUIButtonPlacerY = -85;

        /* Player is set to default spectate */
        this.spectate = false;

        /* Requests information about comets, other players, missiles on screen */
        this.socket.emit('requestInitialize');

        /* Handles spectators */
        this.socket.on('initSpectate', () => {
            this.spectate = true;
            this.spectateText = this.add.text(50, 200, 'Spectating', formatTUT);
            if(this.infoButton) {
                this.infoButton.destroy();
            }
        });

        /* Creates the UI */
        this.makeUI();

        //Game variables
        this.shot = false;
        this.keypressed = false;
        this.reloading = false;
        this.UIOut = false;
        this.UITweening = false;
        this.noMissilesLeft = false;
        this.maxMissilesClientCopy = -1;
        this.activeConsumable = false;
        this.specialAttackActive = false;
        this.specialAttackKey = this.input.keyboard.addKey('Q', false);

        this.created = true;

        //Initializing server-handled objects
        let UITextY = 15;
        this.socket.on("initHealth", baseHealth => {
            this.healthText = this.add
                .text(315, UITextY, `${baseHealth}`, { fontSize: "32px" })
                .setTint(0x303030)
                .setDepth(101);
            this.shopUI.add(this.healthText);
        });
        this.socket.on("initTimer", timer => {
            this.timerText = this.add
                .text(190, UITextY, `${timer}`, { fontSize: "32px" })
                .setTint(0x303030)
                .setDepth(101);
            this.shopUI.add(this.timerText);
        });
        this.socket.on("initCredits", cred => {
            this.creditText = this.add
                .text(700, UITextY, `${cred}`, { fontSize: "32px" })
                .setTint(0x303030)
                .setDepth(101);
            this.shopUI.add(this.creditText);
        });
        this.socket.on("initScore", score => {
            this.scoreText = this.add
                .text(440, UITextY, `${score}`, { fontSize: "32px" })
                .setTint(0x303030)
                .setDepth(101);
            this.shopUI.add(this.scoreText);
        });
        this.socket.on("initRound", round => {
            this.roundText = this.add
                .text(70, UITextY, `${round}`, { fontSize: "32px" })
                .setTint(0x303030)
                .setDepth(101);
            this.shopUI.add(this.roundText);
        });
        this.socket.on("currentPlayers", players => {
            Object.keys(players).forEach(id => {
                if (players[id].playerId === this.socket.id) {
                    this.addPlayer(this, players[id]);
                } else {
                    this.addOtherPlayers(this, players[id]);
                }
            });
        });
        this.socket.on("initComets", serverComets => {
            Object.keys(serverComets).forEach(comet => {
                if (comet != undefined) {
                    this.addComet(this, serverComets[comet]);
                }
            });
        });

        //Events where new objects are created
        this.socket.on("newPlayer", playerInfo => {
            this.addOtherPlayers(this, playerInfo);
        });
        this.socket.on("newMissile", missileInfo => {
            this.addMissile(this, missileInfo);
        });
        this.socket.on("newCrosshair", crosshairInfo => {
            this.addCrosshair(this, crosshairInfo);
        });
        this.socket.on("missileFired", id => {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                if (id == otherPlayer.playerId) {
                    otherPlayer.play('fireShot');
                }
            });
        });

        this.socket.on("laserFired", (center, dir, rot) => {
            this.displayLaser(this, center, dir, rot);
        });

        this.socket.on("flakFired", () => {
            let pointer = this.input.activePointer;
            this.socket.emit("missileShot", {
                x: this.ship.x,
                y: this.ship.y,
                mouseX: pointer.x + 400 * Math.random() - 200,
                mouseY: pointer.y + 400 * Math.random() - 200,
                rotation: this.ship.rotation + 0.6 * Math.random() - 0.3,
                flakSpecial: true
            });
        });

        this.socket.on("nukeFired", () => {
            let pointer = this.input.activePointer;
            this.socket.emit("missileShot", {
                x: this.ship.x,
                y: this.ship.y,
                mouseX: pointer.x,
                mouseY: pointer.y,
                rotation: this.ship.rotation,
                nukeSpecial: true
            });
        })

        this.socket.on("newComet", cometInfo => {
            this.addComet(this, cometInfo);
        });

        //missile count display; reload bar display
        this.socket.on(
            "missileCountChange",
            (id, newAmount, maxAmount, regenTime, displayBar) => {
                if (id == this.playerId) {
                    if (this.debug) {
                        this.missileCountText.setText(
                            `5 - Maximum missile capacity = ${newAmount}`
                        );
                    }
                    if (newAmount == 0) {
                        this.noMissilesLeft = true;
                    } else {
                        this.noMissilesLeft = false;
                    }
                    this.displayMissileCount(
                        this,
                        this,
                        newAmount,
                        maxAmount,
                        regenTime
                    );
                    if (displayBar) {
                        this.displayReloadBar(
                            this,
                            this,
                            this.ship.x,
                            regenTime,
                            this.maxMissilesClientCopy
                        );
                    }
                } else {
                    this.otherPlayers.getChildren().forEach(otherPlayer => {
                        if (id == otherPlayer.playerId) {
                            this.displayMissileCount(
                                this,
                                otherPlayer,
                                newAmount,
                                maxAmount,
                                regenTime
                            );
                            if (displayBar) {
                                this.displayReloadBar(
                                    this,
                                    otherPlayer,
                                    otherPlayer.x,
                                    regenTime,
                                    this.maxMissilesClientCopy
                                );
                            }
                        }
                        this.displayMissileCount(
                            this,
                            this,
                            newAmount,
                            maxAmount,
                            regenTime
                        );
                    });
                }
            }
        );

        //Events where objects are destroyed
        this.socket.on("missileDestroyed", (missileId, size, time) => {
            this.missiles.getChildren().forEach(missile => {
                if (missile.id == missileId) {
                    const explosion = this.add
                        .sprite(missile.x, missile.y, "explosion", 0)
                        .setScale(size / 96);
                    explosion.play("explode");
                    explosion.anims.setTimeScale(40 / time);
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    missile.destroy();
                }
            });
        });

        this.socket.on("crosshairDestroyed", crosshairId => {
            this.crosshairs.getChildren().forEach(crosshair => {
                if (crosshair.id == crosshairId) {
                    crosshair.destroy();
                }
            });
        });

        this.socket.on("cometDestroyed", (cometId, size, time) => {
            this.comets.getChildren().forEach(comet => {
                if (comet.id == cometId) {
                    const explosion = this.add
                        .sprite(comet.x, comet.y, "explosion", 0)
                        .setScale(size / 96);
                    explosion.play("explode");
                    explosion.anims.setTimeScale(40 / time);
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    comet.destroy();
                }
            });
        });

        this.socket.on("disconnect", playerId => {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.missileCountSprite.destroy();
                    otherPlayer.missileCountText.destroy();
                    otherPlayer.specialAttackHolder.destroy();
                    if (otherPlayer.specialAttackIcon != undefined) {
                        otherPlayer.specialAttackIcon.destroy();
                    }
                    otherPlayer.destroy();
                }
            });
            this.otherTankbodys.getChildren().forEach(otherTankbody => {
                if (playerId === otherTankbody.playerId) {
                    otherTankbody.destroy();
                }
            });

            if (playerId == this.playerId) {
                this.socket.close();
            }
        });
        this.socket.on("gameOver", data => {
            data["socket"] = this.socket;
            console.log("game -> end");
            this.scene.start("endScene", data);
            this.socket = undefined;
            console.log(this.socket);
        });

        //Events where object states are updated
        this.socket.on("baseDamaged", info => {
            this.comets.getChildren().forEach(comet => {
                if (comet.id == info[0]) {
                    this.healthText.setText(`${info[1]}`);
                    const explosion = this.add
                        .sprite(comet.x, comet.y, "explosion", 0)
                        .setScale(1);
                    explosion.play("explode");
                    explosion.once(
                        Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,
                        () => {
                            explosion.destroy();
                        }
                    );
                    comet.destroy();
                }
            });
        });
        this.socket.on("missileUpdate", serverMissiles => {
            this.missiles.getChildren().forEach(missile => {
                //console.log(serverMissiles[missile.id].x + "," + serverMissiles[missile.id].y)
                missile.setPosition(
                    serverMissiles[missile.id].x,
                    serverMissiles[missile.id].y
                );
                //console.log(serverMissiles[missile.id].x + "," + serverMissiles[missile.id].y)
            });
        });
        this.socket.on("cometUpdate", serverComets => {
            this.comets.getChildren().forEach(comet => {
                if (serverComets[comet.id] != undefined) {
                    comet.setPosition(
                        serverComets[comet.id].x,
                        serverComets[comet.id].y
                    );
                }
            });
        });
        this.socket.on("playerMoved", playerInfo => {
            this.otherPlayers.getChildren().forEach(otherPlayer => {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    otherPlayer.setRotation(playerInfo.rotation);
                }
            });
        });
        this.socket.on("timerUpdate", timer => {
            this.timerText.setText(`${timer}`);
        });
        this.socket.on("updateCredits", credits => {
            this.creditText.setText(`${credits}`);
        });
        this.socket.on("updateScore", score => {
            this.scoreText.setText(`${score}`);
        });
        this.socket.on("updateCost", info => {
            if (info[0] == "speed") {
                this.speedUpgradeText.setText(`Missile\nSpeed\n\n${info[1]}`);
            } else if (info[0] == "damage") {
                this.damageUpgradeText.setText(`Missile\nDamage\n\n${info[1]}`);
            } else if (info[0] == "radius") {
                this.radiusUpgradeText.setText(
                    `Explosion\nRadius\n\n${info[1]}`
                );
            } else if (info[0] == "regenSpeed") {
                this.regenUpgradeText.setText(
                    `Ammo Regen\nSpeed\n\n${info[1]}`
                );
            } else if (info[0] == "maxMissiles") {
                this.missileCountUpgradeText.setText(
                    `Ammo\nCapacity\n\n${info[1]}`
                );
            }
        });

        this.socket.on("updateSpecialAttack", (id, newAttackName, color) => {
            if (id == this.playerId) {
                this.updateSpecialAttackIcon(this, this, newAttackName, color);
                if (newAttackName === 'none') {
                    this.specialAttackActive = false;
                    this.activeConsumable = false;
                }else {
                    this.activeConsumable = true;
                }
            } else {
                this.otherPlayers.getChildren().forEach(otherPlayer => {
                    if (id == otherPlayer.playerId) {
                        this.updateSpecialAttackIcon(
                            this,
                            otherPlayer,
                            newAttackName,
                            color
                        );
                    }
                });
            }
        });
        this.socket.on("updateRound", round => {
            this.roundText.setText(`${round}`);
        });
        this.socket.on("regenSpeedChange", newRegen => {
            if (this.debug) {
                this.regenSpeedText.setText(`6 - Regen speed = ${newRegen}s`);
            }
        });
        this.socket.on("cometLimitChange", cometLimit => {
            if (this.debug) {
                this.cometLimitText.setText(
                    `7 - Maximum number of comets = ${cometLimit}`
                );
            }
        });
        this.socket.on("cometRateChange", cometRate => {
            if (this.debug) {
                this.cometRateText.setText(
                    `8 - Comet spawn rate = ${cometRate}`
                );
            }
        });
        this.socket.on("cometHealthChange", cometHealth => {
            if (this.debug) {
                this.cometHealthText.setText(
                    `9 - Comet health = ${cometHealth}`
                );
            }
        });
        this.socket.on("cometSpeedChange", cometSpeed => {
            if (this.debug) {
                this.cometSpeedText.setText(`0 - Comet speed = ${cometSpeed}`);
            }
        });
        this.socket.on("baseHealthChange", health => {
            if (this.debug) {
                this.healthText.setText(`${health}`);
            }
        });
        this.socket.on("reload", () => {
            location.reload();
        });
        this.socket.on("debug", data => {
            this.debug = true;
            this.debugMode = -1;
            this.debugText = this.add
                .text(this.ship.x - 20, this.ship.y, "Debug", {
                    fontSize: "24px"
                })
                .setDepth(100);
            this.debugRoundText = this.add
                .text(900, 120, `1 - Round`)
                .setDepth(150);
            this.debugBaseHealthText = this.add
                .text(900, 140, `2 - Base Health`)
                .setDepth(150);
            this.debugTimerText = this.add
                .text(900, 160, `3 - Timer`)
                .setDepth(150);
            this.debugCreditText = this.add
                .text(900, 180, `4 - Credits`)
                .setDepth(150);
            this.maxMissilesText = this.add
                .text(900, 200, `5 - Maximum missile capacity`)
                .setDepth(150);
            this.regenSpeedText = this.add
                .text(900, 220, `6 - Regen speed = ${data.regenSpeed}s`)
                .setDepth(150);
            this.cometLimitText = this.add
                .text(
                    900,
                    240,
                    `7 - Maximum number of comets = ${data.cometLimit}`
                )
                .setDepth(150);
            this.cometRateText = this.add
                .text(900, 260, `8 - Comet spawn rate = ${data.cometRate}`)
                .setDepth(150);
            this.cometHealthText = this.add
                .text(900, 280, `9 - Comet health = ${data.cometHealth}`)
                .setDepth(150);
            this.cometSpeedText = this.add
                .text(900, 300, `0 - Comet speed = ${data.cometSpeed}`)
                .setDepth(150);
        });
    }

    update() {
        if (this.created && !this.spectate && this.ship) {
            //Mouse handling
            let pointer = this.input.activePointer;
            this.ship.rotation = angle(
                pointer.x,
                pointer.y,
                this.ship.x,
                this.ship.y
            );
            this.socket.emit("rotationChange", this.ship.rotation);

            let UICutoffY = 120;

            //make the UI tray come out and go back in
            this.moveUI(pointer, UICutoffY);

            if (pointer.isDown) {
                this.focus = this.pointerInGame
            }

            //Activate special attack
            if (this.focus && this.specialAttackKey.isDown && !this.specialAttackActive && this.activeConsumable) {
                this.specialAttackActive = true;
                this.specialAttackHolder.setTint(0xff0000);
            }

            //Shot handling
            if (
                this.focus &&
                !this.shot &&
                pointer.isDown &&
                pointer.y >= UICutoffY &&
                !this.reloading &&
                (!this.noMissilesLeft || this.specialAttackActive)
            ) {
                this.ship.play('fireShot');
                this.shot = true;

                // specialAttackActive is set to false when specialattackclient copy is set to none
                if (this.specialAttackActive) {
                    this.socket.emit("specialShot");
                    this.activeConsumable = false;
                }

                if (!this.specialAttackActive) {
                    this.socket.emit("missileShot", {
                        x: this.ship.x,
                        y: this.ship.y,
                        mouseX: pointer.x,
                        mouseY: pointer.y,
                        rotation: this.ship.rotation
                    });
                }
            }

            if (!pointer.isDown) {
                this.shot = false;
            }

            let keyb = this.input.keyboard;

            keyb.addListener("keydown", event => {
                if (!this.focus) {
                    return;
                }
                if (event.keyCode === 192) {
                    this.socket.emit("enterDebug");
                }
                if (this.debug) {
                    if (event.keyCode === 48) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("cometSpeed");
                    }
                    if (event.keyCode === 49) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("round");
                    }
                    if (event.keyCode === 50) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("baseHealth");
                    }
                    if (event.keyCode === 51) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("timer");
                    }
                    if (event.keyCode === 52) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("credits");
                    }
                    if (event.keyCode === 53) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("maxMissiles");
                    }
                    if (event.keyCode === 54) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("regenSpeed");
                    }
                    if (event.keyCode === 55) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("cometLimit");
                    }
                    if (event.keyCode === 56) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("cometRate");
                    }
                    if (event.keyCode === 57) {
                        this.debugMode = event.keyCode - 48;
                        this.debugText.setText("cometHealth");
                    }

                    let negative = 1;
                    if (event.keyCode === 189) {
                        negative = -1;
                    }
                    if (
                        !this.keypressed &&
                        (event.keyCode === 189 || event.keyCode === 187)
                    ) {
                        this.key = new Phaser.Input.Keyboard.Key(
                            keyb,
                            event.keyCode
                        );
                        this.keypressed = true;
                        switch (this.debugMode) {
                            case 0:
                                this.socket.emit(
                                    "changeCometSpeed",
                                    1 * negative
                                );
                                break;
                            case 1:
                                this.socket.emit("changeRound");
                                break;
                            case 2:
                                this.socket.emit(
                                    "changeBaseHealth",
                                    10 * negative
                                );
                                break;
                            case 3:
                                this.socket.emit("changeTimer", 5 * negative);
                                break;
                            case 4:
                                this.socket.emit(
                                    "changeCredits",
                                    100 * negative
                                );
                                break;
                            case 5:
                                this.socket.emit(
                                    "changeMaxMissiles",
                                    1 * negative
                                );
                                break;
                            case 6:
                                this.socket.emit(
                                    "changeRegenSpeed",
                                    1 * negative
                                );
                                break;
                            case 7:
                                this.socket.emit(
                                    "changeCometLimit",
                                    1 * negative
                                );
                                break;
                            case 8:
                                this.socket.emit(
                                    "changeCometRate",
                                    -500 * negative
                                );
                                break;
                            case 9:
                                this.socket.emit(
                                    "changeCometHealth",
                                    1 * negative
                                );
                                break;
                        }
                    }
                }
            });

            if (this.key && !this.key.isDown) {
                this.keypressed = false;
            }
        }
    }

    //Function for UI tray movement
    moveUI(pointer, UICutoffY) {
        if (!this.UITweening) {
            if (pointer.y >= UICutoffY || !this.pointerInGame) {
                if (this.UIOut) {
                    this.tweens.add({
                        targets: this.shopUI.getChildren(),
                        y: "-=120",
                        duration: 100
                    });
                    this.UITweening = true;
                    setTimeout(() => (this.UITweening = false), 150);
                    this.UIOut = false;
                }
            } else {
                if (!this.UIOut && this.pointerInGame) {
                    this.tweens.add({
                        targets: this.shopUI.getChildren(),
                        y: "+=120",
                        duration: 100
                    });
                    this.UITweening = true;
                    setTimeout(() => (this.UITweening = false), 150);
                    this.UIOut = true;
                }
            }
        }
    }

    //Helper add functions
    addTankBody(self, playerInfo) {
        return self.add
            .sprite(
                playerInfo.x,
                playerInfo.y,
                "tankbody" + (1 + Math.round((playerInfo.x - 160) / 320.0))
            )
            .setScale(0.5)
            .setDepth(25);
    }

    addMissileCounter(self, somePlayer, playerInfo) {
        somePlayer.missileCountSprite = self.add
            .sprite(playerInfo.x - 45, 575, "missile")
            .setDisplaySize(20, 30)
            .setDepth(100);
        somePlayer.missileCountText = self.add
            .text(
                playerInfo.x - 15,
                575,
                "" + playerInfo.missiles + "/" + playerInfo.maxMissiles,
                { fontSize: "24px" }
            )
            .setTint(0xffffff)
            .setDepth(100);
    }

    addSpecialAttackHolder(self, somePlayer, playerInfo) {
        somePlayer.specialAttackHolder = self.add
            .sprite(playerInfo.x - 60, 650, "specialholder")
            .setDisplaySize(32, 32)
            .setDepth(100);
    }

    updateSpecialAttackIcon(self, somePlayer, newAttackName, color) {
        if (somePlayer.specialAttackIcon != undefined) {
            somePlayer.specialAttackIcon.destroy();
        }
        if (newAttackName == "none") {
            if (self === somePlayer) {
                self.specialAttackHolder.setTint(0xffffff);
            }
            return;
        }

        somePlayer.specialAttackIcon = self.add
            .sprite(
                somePlayer.specialAttackHolder.x,
                somePlayer.specialAttackHolder.y,
                newAttackName
            )
            .setDisplaySize(24, 24)
            .setDepth(101)
            .setTint(color);
    }

    addPlayer(self, playerInfo) {
        self.addTankBody(self, playerInfo);
        self.ship = self.physics.add
            .sprite(playerInfo.x, playerInfo.y - 10, "tankbarrel")
            .setScale(0.7)
            .setDepth(20);
        self.ship.setDrag(100);
        self.ship.setAngularDrag(100);
        self.ship.setMaxVelocity(200);
        self.playerId = playerInfo.playerId;
        self.addMissileCounter(self, self, playerInfo);
        self.addSpecialAttackHolder(self, self, playerInfo);
        self.maxMissilesClientCopy = playerInfo.maxMissiles;
    }

    addOtherPlayers(self, playerInfo) {
        const otherTankbody = self.addTankBody(self, playerInfo);
        const otherPlayer = self.add
            .sprite(playerInfo.x, playerInfo.y - 10, "tankbarrel")
            .setScale(0.7)
            .setDepth(20);
        otherPlayer.playerId = playerInfo.playerId;
        otherPlayer.rotation = playerInfo.rotation;
        self.addMissileCounter(self, otherPlayer, playerInfo);
        self.addSpecialAttackHolder(self, otherPlayer, playerInfo);
        self.maxMissilesClientCopy = playerInfo.maxMissiles;
        otherTankbody.playerId = playerInfo.playerId;
        self.otherPlayers.add(otherPlayer);
        self.otherTankbodys.add(otherTankbody);
    }

    addMissile(self, missileInfo) {
        let missile;
        if (!missileInfo.flakSpecial && !missileInfo.nukeSpecial) {
            missile = self.add
                .sprite(missileInfo.x, missileInfo.y, "missile")
                .setDepth(15)
                .setScale(0.1875);
        } else if (missileInfo.flakSpecial) {
            missile = self.add
                .sprite(missileInfo.x, missileInfo.y, "missile")
                .setDepth(15)
                .setScale(0.02);
        }else {
            // make nuke here
            missile = self.add
                .sprite(missileInfo.x, missileInfo.y, "nuke-projectile")
                .setDepth(15)
                .setScale(0.25);
            missile.play("nukeRevolve");
        }

        missile.rotation = missileInfo.rotation;
        missile.id = missileInfo.id;
        self.missiles.add(missile);
    }

    addCrosshair(self, crosshairInfo) {
        const crosshair = self.add
            .sprite(crosshairInfo.mouseX, crosshairInfo.mouseY, "crosshair")
            .setScale(0.3);

        crosshair.id = crosshairInfo.id;
        self.crosshairs.add(crosshair);
    }

    addComet(self, cometInfo) {
        const comet = self.add
            .sprite(cometInfo.x, cometInfo.y, "comet")
            .setDisplaySize(32, 64);
        comet.rotation = cometInfo.rotation;
        comet.id = cometInfo.id;
        comet.play('cometRevolve');
        self.comets.add(comet);
    }

    displayLaser(self, center, dir, rot) {
        let tempLaser = self.add
            .sprite(center.x + 670 * dir.x, center.y + 670 * dir.y, "laser")
            .setDisplaySize(100, 1280)
            .setDepth(5);
        tempLaser.play("laserFlux");
        tempLaser.rotation = rot;
        tempLaser.alpha = 1;
        var drawLoop = setInterval(() => {
            tempLaser.alpha -= 0.02;
            if (tempLaser.alpha <= 0.01) {
                tempLaser.destroy();
                clearInterval(drawLoop);
            }
        }, 16);
    }

    displayReloadBar(
        self,
        shipThatHasThisBar,
        positionX,
        reloadTime,
        newMaxMissiles
    ) {
        const width = 120;
        const height = 16;
        const positionY = 708;

        shipThatHasThisBar.maxMissilesClientCopy = newMaxMissiles;

        //show the empty bar
        const reloadBarBase = self.add
            .sprite(positionX, positionY, "reloadmeter")
            .setDisplaySize(width, height)
            .setTint(0xbb0000)
            .setDepth(100);
        const reloadBarFront = self.add
            .sprite(positionX - width * 0.5, positionY, "reloadmeter")
            .setDisplaySize(0, height)
            .setTint(0x00ff00)
            .setDepth(101);
        //update every frame until max missiles
        let timer = 0;
        let oldMaxMissiles = newMaxMissiles;
        var drawLoop = setInterval(() => {
            if (
                timer >= reloadTime ||
                shipThatHasThisBar.maxMissilesClientCopy != oldMaxMissiles
            ) {
                reloadBarBase.destroy();
                reloadBarFront.destroy();
                clearInterval(drawLoop);
            } else {
                let progress = timer / reloadTime;
                reloadBarFront.setPosition(
                    positionX - width * 0.5 + progress * width * 0.5,
                    positionY
                );
                reloadBarFront.setDisplaySize(progress * width, height);
                timer += 16;
            }
        }, 16);
    }

    displayMissileCount(self, somePlayer, newAmount, maxAmount, regenTime) {
        somePlayer.maxMissilesClientCopy = maxAmount;
        somePlayer.missileCountText.setText("" + newAmount + "/" + maxAmount);
    }

    makeUI() {
        const shopUIBackground = this.add
            .sprite(640, -40, "shopbg")
            .setDisplaySize(1280, 200)
            .setTint(0xffffff)
            .setDepth(100);
        this.shopUI.add(shopUIBackground);

        if (!this.spectate) {
            this.infoButton = this.add.image(1220, 50, 'info')
                .setScale(0.5)
                .setDepth(100)
                .setInteractive()
                .on('pointerover', () => {
                    this.roundInfoText = this.add.text(10, 185, 'The current\nround', textFormatSmall).setDepth(102);
                    this.timerInfoText = this.add.text(120, 185, 'How many\nseconds until\nthe round/break\nends', textFormatSmall).setDepth(102);
                    this.healthInfoText = this.add.text(240, 185, 'Current base\nhealth', textFormatSmall).setDepth(102);
                    this.scoreInfoText = this.add.text(360, 185, 'Current game score', textFormatSmall).setDepth(102);
                    this.creditInfoText = this.add.text(640, 185, 'Current amount\nof credits', textFormatSmall).setDepth(102);
                    this.missileCountInfoText = this.add.text(this.ship.x - 100, 600, 'The amount of missiles you have', textFormatSmall).setDepth(102);
                    this.instructionsText = this.add.text(990, 185, "Click anywhere to fire a missile.\nThe missile will explode at the\ncrosshair, and the explosion will do\ndamage to the comets.\n\nIf you purchase a fireable consumable,\npress 'q' and click to fire\nin the desired direction.\n\nAs the rounds progress, comets will\nincrease in number, speed, and damage.\nIf a comet reaches the base,\nyour base will receive damage equal\nto the comet's current health.\n\nYou lose when base health reaches 0.", textFormatSmall);
                })
                .on('pointerout', () => {
                    if (this.roundInfoText) {
                        this.roundInfoText.destroy();
                    }
                    if (this.timerInfoText) {
                        this.timerInfoText.destroy();
                    }
                    if (this.healthInfoText) {
                        this.healthInfoText.destroy();
                    }
                    if (this.scoreInfoText) {
                        this.scoreInfoText.destroy();
                    }
                    if (this.creditInfoText) {
                        this.creditInfoText.destroy();
                    }
                    if (this.missileCountInfoText) {
                        this.missileCountInfoText.destroy();
                    }
                    if (this.instructionsText) {
                        this.instructionsText.destroy();
                    }
                })
            this.makeUIButtons(this);
        }
    }

    makeButtonClickBehavior(self, button, onClickFunction) {
        button
            .on("pointerover", () => {
                button.setTint(0xfcfcfc);
            })
            .on("pointerout", () => {
                button.setTint(0xcfcfcf);
            })
            .on("pointerdown", onClickFunction);
    }

    //this helper makes a button
    makeUIButtonHelper(self, name, text, upgradeType, description) {
        let xpos = self.shopUIButtonPlacerX;
        let ypos = self.shopUIButtonPlacerY;
        self.shopUIButtonPlacerX += 160;

        self[name + 'Text'] = self.add.text(xpos - 40, ypos - 25, text, { fontSize: '18px' }).setDepth(102);
        self[name] = self.add.image(xpos, ypos, 'button').setDepth(101).setScale(1.5).setTint(0xcfcfcf)
            .setInteractive()
            .on('pointerover', () => {
                this.upgradeHelpText = this.add.text(xpos - 60, ypos + 270, description, textFormatSmall).setDepth(200);
            })
            .on('pointerout', () => {
                if (this.upgradeHelpText) {
                    this.upgradeHelpText.destroy();
                }
            })
        self.makeButtonClickBehavior(self, self[name], () => {
            self.socket.emit("attemptUpgrade", upgradeType);
        });
        self.shopUI.add(self[name]);
        self.shopUI.add(self[name + "Text"]);
    }

    makeUIHalfButtonHelper(self, name, text, consumableType, description) {
        let xpos = self.shopUIButtonPlacerX;
        let ypos = self.shopUIButtonPlacerY;
        if (ypos > -80) {
            self.shopUIButtonPlacerY = -85;
            self.shopUIButtonPlacerX += 130;
        } else {
            self.shopUIButtonPlacerY += 65;
        }

        self[name + 'Text'] = self.add.text(xpos - 55, ypos - 32, text, { fontSize: '16px' }).setDepth(102).setTint(0x202020);
        self[name] = self.add.image(xpos, ypos - 19, 'halfbutton').setDepth(101).setScale(1.25).setTint(0xcfcfcf)
            .setInteractive()
            .on('pointerover', () => {
                this.upgradeHelpText = this.add.text(xpos - 60, ypos + 270, description, textFormatSmall).setDepth(200);
            })
            .on('pointerout', () => {
                if (this.upgradeHelpText) {
                    this.upgradeHelpText.destroy();
                }
            })
        self.makeButtonClickBehavior(self, self[name], () => {
            self.socket.emit("attemptBuyConsumable", consumableType);
        });
        self.shopUI.add(self[name]);
        self.shopUI.add(self[name + "Text"]);
    }

    makeUIButtons(self) {
        this.makeUIButtonHelper(
            self,
            "speedUpgrade",
            "Missile\nSpeed\n\n1000",
            "speed",
            "Increases the rate\nat which missiles fly"
        );
        this.makeUIButtonHelper(
            self,
            "damageUpgrade",
            "Missile\nDamage\n\n1000",
            "damage",
            "Increases the damage\nof your missiles"
        );
        this.makeUIButtonHelper(
            self,
            "radiusUpgrade",
            "Explosion\nRadius\n\n400",
            "radius",
            "Increases the explosion\nradius of your missiles"
        );
        this.makeUIButtonHelper(
            self,
            "regenUpgrade",
            "Ammo Regen\nSpeed\n\n500",
            "regenSpeed",
            "Increases how fast\nyour missiles regenerate"
        );
        this.makeUIButtonHelper(
            self,
            "missileCountUpgrade",
            "Ammo\nCapacity\n\n800",
            "maxMissiles",
            "Increases how many\nmissiles you can store"
        );

        this.makeUIHalfButtonHelper(
            self,
            "laserConsumable",
            "Laser\n1500",
            "laser",
            "Fires a laser beam in\na line,hitting multiple\ntargets. Grants 3 uses"
        );

        this.makeUIHalfButtonHelper(
            self,
            "flakConsumable",
            "Flak\n100",
            "flak",
            "For 10 seconds, fire\nnumerous smaller missiles\nnear the cursor location"
        );

        this.makeUIHalfButtonHelper(
            self,
            "nukeConsumable",
            "Nuke\n200",
            "nuke",
            "Huge explosion radius"
        )

        //To add more half-buttons, just list them as follows, and they will appear in the shop at an appropriate place

        /*this.makeUIHalfButtonHelper(
            self,
            "laserConsumable",
            "Laser Shots\n1500",
            "laser"
        );
    
        this.makeUIHalfButtonHelper(
            self,
            "laserConsumable",
            "Laser Shots\n1500",
            "laser"
        );*/
    }
}

export default GameScene;
