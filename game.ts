///<reference path="three.d.ts"/>
// ENGINE

import WebGLRenderer = THREE.WebGLRenderer;
import PerspectiveCamera = THREE.PerspectiveCamera;
import Scene = THREE.Scene;
import Mesh = THREE.Mesh;
import CubeGeometry = THREE.CubeGeometry;
import MeshBasicMaterial = THREE.MeshBasicMaterial;
import Renderer = THREE.Renderer;
import Vector3 = THREE.Vector3;

enum Direction {
    UP,
    DOWN,
    LEFT,
    RIGHT,
    NONE
}

interface KeyboardState {
    [i: number]: boolean;
}

class Bounds {
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    constructor(x1: number = 0, y1: number = 0, x2: number = 0, y2: number = 0) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }
}

interface StepFunc {
    (inputs: KeyboardState): void;
}

interface CollideFunc {
    (e: Entity): void;
}

interface DestroyFunc {
    (e: Entity): void;
}

abstract class Component {
    abstract handle(): void;
    destroy(): void {}
}

class Drawable extends Component {
    model: Mesh = null;
    renderer: Renderer;
    scene: Scene;
    parent: Entity;

    handle() {
        this.model.position.x = this.parent.position.x + this.parent.width / 2;
        this.model.position.y = this.parent.position.y + this.parent.height / 2;
        this.model.position.z = this.parent.position.z;
    }

    destroy() {
        if(this.model)
            this.scene.remove(this.model);
    }

    constructor(parent: Entity, renderer: Renderer, scene: Scene, model?: Mesh) {
        super();

        this.parent = parent;
        this.renderer = renderer;
        this.scene = scene;

        if(model) {
            this.model = model;
            scene.add(model);
        }
    }
}

class TextDrawable extends Component {
    position: {x: number, y: number};
    text: string;
    color: string;
    private div;

    handle() {
        this.div.innerHTML = this.text;
        this.div.style.left = this.position.x;
        this.div.style.top = this.position.y;
        this.div.style.color = this.color;
    }

    destroy() {

    }

    constructor(position: {x: number, y: number}, text: string, color: string) {
        super();

        this.position = position;
        this.text = text;
        this.color = color;

        this.div = document.createElement("div");
        this.div.style.position = "absolute";
        this.div.style.width = 100;
        this.div.style.height = 100;
        document.body.insertBefore(this.div, document.body.firstChild);
    }
}

class Entity {
    type: string;
    solid: boolean = true;
    enabled: boolean = true;
    components: Component[] = [];
    width: number;
    height: number;
    position: {x: number, y: number, z: number};
    velocity: {x: number, y: number, z: number} = {x: 0, y: 0, z: 0};
    properties: any;
    world: World;
    markedForDeletion: boolean = false;

    customStep: StepFunc = null;
    customCollide: CollideFunc = null;
    onDestroy: DestroyFunc = null;

    step(inputs: KeyboardState) {
        for(let e of this.components)
            e.handle();

        if(this.customStep)
            this.customStep(inputs);
        else {
            this.move();
        }
    }

    getBounds(): Bounds {
        return new Bounds(this.position.x, this.position.y, this.position.x + this.width, this.position.y + this.height);
    }

    collidesWith(e: Entity): boolean {
        let b1 = this.getBounds();
        let b2 = e.getBounds();

        return (b1.x1 < b2.x2 &&
            b1.x2 > b2.x1 &&
            b1.y1 < b2.y2 &&
            b1.y2 > b2.y1);
    }

    collide(e: Entity) {
        if(this.customCollide)
            this.customCollide(e);
    }

    getGridPos(): {x: number, y: number} {
        return {x: Math.round(this.position.x), y: Math.round(this.position.y)};
    }

    moving() {
        return this.velocity.x == 0 && this.velocity.y == 0 && this.velocity.z == 0;
    }

    move(velocity?: {x: number, y: number, z: number}) {
        let vel = velocity ? velocity : this.velocity;

        this.position.x += vel.x;
        this.position.y += vel.y;
        this.position.z += vel.z;
    }

    destroy() {
        this.markedForDeletion = true;

        for(let c of this.components)
            c.destroy();
    }

    constructor(type: string, world: World, width: number, height: number, position: {x: number, y: number, z: number}) {
        this.type = type;
        this.world = world;
        this.width = width;
        this.height = height;
        this.position = position;
    }
}

class CollisionHandler {
    pairs: {[type: string]: [string]} = {};

    handleCollisions(entities: Entity[]) {
        function inArr(str: string, arr: string[]): boolean {
            for(let s of arr)
                if(s === str)
                    return true;

            return false;
        }

        for(let e1 of entities)
            for(let e2 of entities)
                if(e1.solid && e2.solid)
                    if(e1 !== e2 && e1.collidesWith(e2)) {
                        if (this.pairs[e1.type] != undefined && inArr(e2.type, this.pairs[e1.type]))
                            e1.collide(e2);
                        if (this.pairs[e2.type] != undefined && inArr(e1.type, this.pairs[e2.type]))
                            e2.collide(e1);
                    }
    }
}

class World {
    entities: Entity[] = [];
    inputs: KeyboardState = [];
    collisionHandler: CollisionHandler = new CollisionHandler();
    scripts: {[name: string]: any} = [];

    pressKey(key: number) {
        this.inputs[key] = true;
    }

    releaseKey(key: number) {
        this.inputs[key] = false;
    }

    handleDeletions() {
        for(let i = 0; i < this.entities.length; i++)
            if(this.entities[i].markedForDeletion)
                this.entities.splice(i--, 1);
    }

    step() {
        for(let e of this.entities)
            if(e.enabled)
                e.step(this.inputs);

        this.handleDeletions();
    }

    handleComponents() {
        for(let e of this.entities)
            for(let c of e.components)
                if(!(c instanceof Drawable))
                    c.handle();

        this.handleDeletions();
    }

    handleCollisions() {
        this.collisionHandler.handleCollisions(this.entities);

        this.handleDeletions();
    }

    draw() {
        for(let e of this.entities)
            for(let c of e.components)
                if(c instanceof Drawable)
                    c.handle();

        renderer.render(scene, camera);
    }
}


// GAME

function buildFrog(): Entity {
    let frog: Entity = new Entity("frog", world, 1, 1, {x: 8, y: 0, z: 0});

    frog.customStep = function(inputs: KeyboardState) {
        if(this.properties.jumpDir != Direction.NONE) {
            this.move();

            this.properties.jumpProgress++;
            this.position.z = Math.sin((this.properties.jumpProgress / this.properties.jumpSteps) * Math.PI) * 0.3;

            switch(this.properties.jumpDir) {
                case Direction.UP:
                    if(this.position.y >= this.properties.targetSquare.y) {
                        this.position.y = this.properties.targetSquare.y;
                        this.properties.jumpDir = Direction.NONE;
                    }
                    break;
                case Direction.DOWN:
                    if(this.position.y <= this.properties.targetSquare.y) {
                        this.position.y = this.properties.targetSquare.y;
                        this.properties.jumpDir = Direction.NONE;
                    }
                    break;
                case Direction.LEFT:
                    if(this.position.x <= this.properties.targetSquare.x) {
                        this.position.x = this.properties.targetSquare.x;
                        this.properties.jumpDir = Direction.NONE;
                    }
                    break;
                case Direction.RIGHT:
                    if(this.position.x >= this.properties.targetSquare.x) {
                        this.position.x = this.properties.targetSquare.x;
                        this.properties.jumpDir = Direction.NONE;
                    }
            }

            if(this.properties.jumpDir == Direction.NONE) {
                this.velocity = {x: 0, y: 0, z: 0};
                this.position.z = 0;
            }
        } else {
            if(this.properties.markedForDeath && this.properties.passiveVelocity.x == 0 &&
                this.properties.passiveVelocity.y == 0 && this.properties.passiveVelocity.z == 0) {
                this.world.scripts.killFrog(this);
                return;
            }

            this.move(this.properties.passiveVelocity);

            let jump: boolean = false;
            let curPos = this.getGridPos();

            if(87 in inputs && inputs[87] && frog.position.y < 12) { // w
                this.properties.jumpDir = Direction.UP;
                this.velocity = {x: 0, y: this.properties.jumpSpeed, z: 0};
                curPos.y++;
                jump = true;
            } else if(65 in inputs && inputs[65] && this.position.x > 0) { // a
                this.properties.jumpDir = Direction.LEFT;
                this.velocity = {x: -this.properties.jumpSpeed, y: 0, z: 0};
                curPos.x--;
                jump = true;
            } else if(83 in inputs && inputs[83] && frog.position.y > 0) { // s
                this.properties.jumpDir = Direction.DOWN;
                this.velocity = {x: 0, y: -this.properties.jumpSpeed, z: 0};
                curPos.y--;
                jump = true;
            } else if(68 in inputs && inputs[68] && this.position.x < 16) { // d
                this.properties.jumpDir = Direction.RIGHT;
                this.velocity = {x: this.properties.jumpSpeed, y: 0, z: 0};
                curPos.x++;
                jump = true;
            }

            if(jump) {
                this.properties.targetSquare = curPos;
                this.properties.passiveVelocity = {x: 0, y: 0, z: 0};
                this.properties.jumpSteps = 1 / this.properties.jumpSpeed;
                this.properties.jumpProgress = 0;
            }
        }

        this.properties.markedForDeath = false;
    };

    frog.customCollide = function(e: Entity) {
        switch(e.type) {
            // enemies/death zones
            case "vehicle":
            case "crocodile":
                this.world.scripts.killFrog(this);
                break;

            case "water":
                if(this.properties.jumpDir == Direction.NONE)
                    this.properties.markedForDeath = true;

                break;

            // platforms
            case "log":
                if(this.properties.jumpDir == Direction.NONE)
                    this.properties.passiveVelocity = e.velocity;

                break;
            case "turtle":
                if(this.properties.jumpDir == Direction.NONE) {
                    this.properties.passiveVelocity = e.velocity;

                    if (e.properties.state === "submerged" && e.velocity.z == 0)
                        this.world.scripts.killFrog(this);
                }
        }
    };

    let vel: {x: number, y: number, z: number} = {x: 0, y: 0, z: 0};
    let jumpDir: Direction = Direction.NONE;
    let targetSquare: {x: number, y: number} = {x: 0, y: 0};
    let lives: number = 3;

    frog.properties = {passiveVelocity: vel, jumpDir: jumpDir, targetSquare: targetSquare, jumpSpeed: 0.07,
        jumpSteps: 0, jumpProgress: 0, markedForDeath: false, lives: lives};

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x00FF00});
    let mesh: Mesh = new Mesh(new CubeGeometry(frog.width, frog.height, 1), material);
    mesh.scale.set(0.9, 0.9, 1);
    let drawComp: Drawable = new Drawable(frog, renderer, scene, mesh);
    frog.components.push(drawComp);

    let livesDrawable: TextDrawable = new TextDrawable({x: 5, y: 5}, "test", "#FF0000");
    frog.components.push(livesDrawable);

    return frog;
}

function buildLogBuilder(y: number, speed: number, direction: Direction): Entity {
    let builder = new Entity("log builder", world, 0, 0, {x: 0, y: 0, z: 0});
    builder.solid = false;

    builder.properties = {y: y, stepsToNext: Math.round(Math.random() * 30 * 5)};

    builder.customStep = function(inputs: KeyboardState) {
        if(--this.properties.stepsToNext <= 0) {
            let log = buildLog(this.properties.y, speed, direction);
            log.world.entities.push(log);

            let stepsPerBlock = 1 / Math.abs(log.velocity.x);
            this.properties.stepsToNext = Math.round(stepsPerBlock * (log.width + 1 + Math.floor(Math.random() * 6)));
        }
    };

    return builder;
}

function buildLog(y: number, speed: number, direction: Direction): Entity {
    let width = 2 + Math.floor(Math.random() * 4);
    let log = new Entity("log", world, width, 1, {x: (direction === Direction.RIGHT) ? -width : 17, y: y, z: -1});
    log.velocity.x = (direction === Direction.RIGHT) ? speed : -speed;

    log.customStep = function(inputs: KeyboardState) {
        this.move();

        if((this.velocity.x > 0 && this.position.x > 18) || (this.velocity.x < 0 && this.position.x < -1 - this.width))
            this.destroy();
    };

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x614126});
    let mesh: Mesh = new Mesh(new CubeGeometry(log.width, log.height, 1), material);
    mesh.scale.set(1, 0.9, 1);
    let drawComp: Drawable = new Drawable(log, renderer, scene, mesh);
    log.components.push(drawComp);

    return log;
}

function buildTurtleBuilder(y: number, speed: number, direction: Direction) : Entity {
    let builder = new Entity("turtle builder", world, 0, 0, {x: 0, y: 0, z: 0});
    builder.solid = false;

    builder.properties = {y: y, stepsToNext: Math.round(Math.random() * 30 * 5)};

    builder.customStep = function(inputs: KeyboardState) {
        if(--this.properties.stepsToNext <= 0) {
            let groupSize = 2 + Math.round(Math.random());
            let sinkPeriod = 30 * (1 + Math.floor(Math.random() * 10));

            for(let i = 0; i < groupSize; i++) {
                var turtle = buildTurtle(this.properties.y, speed, direction, sinkPeriod);
                turtle.position.x += (direction === Direction.RIGHT) ? -i : i;
                turtle.world.entities.push(turtle);
            }

            let stepsPerBlock = 1 / Math.abs(turtle.velocity.x);
            this.properties.stepsToNext = Math.round(stepsPerBlock * (groupSize + 1 + Math.floor(Math.random() * 6)));
        }
    };

    return builder;
}

function buildTurtle(y: number, speed: number, direction: Direction, sinkPeriod: number): Entity {
    let turtle = new Entity("turtle", world, 1, 1, {x: (direction === Direction.RIGHT) ? -1 : 17, y: y, z: -1});
    turtle.velocity.x = (direction === Direction.RIGHT) ? speed : -speed;

    turtle.properties = {state: "floating", sinkPeriod: sinkPeriod, stepsToSink: sinkPeriod};

    turtle.customStep = function(inputs: KeyboardState) {
        this.move();

        if(--this.properties.stepsToSink == 0)
            this.velocity.z = (this.properties.state === "floating") ? -speed : speed;

        if(this.properties.stepsToSink < 0) {
            if(this.properties.state === "floating" && this.position.z < -2.01) {
                this.position.z = -2.01;
                this.velocity.z = 0;
                this.properties.state = "submerged";

                this.properties.stepsToSink = sinkPeriod;
            } else if(this.properties.state === "submerged" && this.position.z > -1) {
                this.position.z = -1;
                this.velocity.z = 0;
                this.properties.state = "floating";

                this.properties.stepsToSink = sinkPeriod;
            }
        }

        if((this.velocity.x > 0 && this.position.x > 18) || (this.velocity.x < 0 && this.position.x < -2))
            this.destroy();
    };

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x006400});
    let mesh: Mesh = new Mesh(new CubeGeometry(turtle.width, turtle.height, 1), material);
    mesh.scale.set(0.9, 0.9, 1);
    let drawComp: Drawable = new Drawable(turtle, renderer, scene, mesh);
    turtle.components.push(drawComp);

    return turtle;
}

function buildVehicleBuilder(y: number, speed: number, direction: Direction): Entity {
    let builder = new Entity("vehicle builder", world, 0, 0, {x: 0, y: 0, z: 0});
    builder.solid = false;

    builder.properties = {y: y, stepsToNext: Math.round(Math.random() * 30 * 5)};

    builder.customStep = function(inputs: KeyboardState) {
        if(--this.properties.stepsToNext <= 0) {
            var vehicle = buildVehicle(this.properties.y, speed, direction);
            vehicle.world.entities.push(vehicle);

            let stepsPerBlock = 1 / Math.abs(vehicle.velocity.x);
            this.properties.stepsToNext = Math.round(stepsPerBlock * (3 + Math.floor(Math.random() * 6)));
        }
    };

    return builder;
}

function buildVehicle(y: number, speed: number, direction: Direction): Entity {
    let vehicle = new Entity("vehicle", world, 1, 1, {x: (direction === Direction.RIGHT) ? -1 : 17, y: y, z: 0});
    vehicle.velocity.x = (direction === Direction.RIGHT) ? speed : -speed;

    vehicle.customStep = function(inputs: KeyboardState) {
        this.move();

        if((this.velocity.x > 0 && this.position.x > 18) || (this.velocity.x < 0 && this.position.x < -2))
            this.destroy();
    };

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0xb20000});
    let mesh: Mesh = new Mesh(new CubeGeometry(vehicle.width, vehicle.height, 1), material);
    let drawComp: Drawable = new Drawable(vehicle, renderer, scene, mesh);
    vehicle.components.push(drawComp);

    return vehicle;
}

function buildWater(x: number, y: number): Entity {
    let water = new Entity("water", world, 1, 1, {x: x, y: y, z: -2});

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x40a4df});
    let mesh: Mesh = new Mesh(new CubeGeometry(water.width, water.height, 1), material);
    let drawComp: Drawable = new Drawable(water, renderer, scene, mesh);
    water.components.push(drawComp);

    return water;
}

function buildRoad(x: number, y: number, width: number, height: number): Entity {
    let road = new Entity("road", world, width, height, {x: x, y: y, z: -1});

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x939393});
    let mesh: Mesh = new Mesh(new CubeGeometry(road.width, road.height, 1), material);
    let drawComp: Drawable = new Drawable(road, renderer, scene, mesh);
    road.components.push(drawComp);

    return road;
}

function buildCameraView(camera: PerspectiveCamera, follow: Entity): Entity {
    let view = new Entity("camera view", world, 0, 0, {x: 0, y: 0, z: 0});
    view.solid = false;

    view.properties = {camera: camera, follow: follow};

    view.customStep = function(inputs: KeyboardState) {
        let xAdj = (this.properties.follow.position.x - 8) * 0.45;
        this.properties.camera.position.x = 8.5 + xAdj;
        this.properties.camera.position.y = this.properties.follow.position.y - 7;
        this.properties.camera.position.z = 6;

        this.properties.camera.lookAt(new Vector3(this.properties.camera.position.x, this.properties.camera.position.y + 7, 1));
    };

    return view;
}

const WIDTH = 640;
const HEIGHT = 480;

const FOV_ANGLE = 45;

let renderer: WebGLRenderer;
let camera: PerspectiveCamera;
let scene: Scene;

let world: World = new World();

function buildWorld() {
    world.scripts["gameOver"] = (self: World) => {
        console.log("game over");
        // TODO: game over
    };

    world.scripts["killFrog"] = (frog: Entity) => {
        frog.properties.lives--;
        frog.properties.markedForDeath = false;
        frog.properties.jumpDir = Direction.NONE;

        if(frog.properties.lives >= 0) {
            frog.position = {x: 8, y: 0, z: 0};
            frog.properties.passiveVelocity = {x: 0, y: 0, z: 0};
        } else {
            frog.world.scripts.gameOver(frog.world);
        }
    };

    let frog: Entity = buildFrog();
    world.entities.push(frog);

    let logBuilder: Entity = buildLogBuilder(8, 0.02, Direction.RIGHT);
    world.entities.push(logBuilder);
    logBuilder = buildLogBuilder(9, 0.04, Direction.RIGHT);
    world.entities.push(logBuilder);
    logBuilder = buildLogBuilder(11, 0.03, Direction.RIGHT);
    world.entities.push(logBuilder);

    let turtleBuilder: Entity = buildTurtleBuilder(7, 0.025, Direction.LEFT);
    world.entities.push(turtleBuilder);
    turtleBuilder = buildTurtleBuilder(10, 0.025, Direction.LEFT);
    world.entities.push(turtleBuilder);

    let vehicleBuilder: Entity = buildVehicleBuilder(1, 0.015, Direction.LEFT);
    world.entities.push(vehicleBuilder);
    vehicleBuilder = buildVehicleBuilder(2, 0.025, Direction.RIGHT);
    world.entities.push(vehicleBuilder);
    vehicleBuilder = buildVehicleBuilder(3, 0.03, Direction.LEFT);
    world.entities.push(vehicleBuilder);
    vehicleBuilder = buildVehicleBuilder(4, 0.025, Direction.RIGHT);
    world.entities.push(vehicleBuilder);
    vehicleBuilder = buildVehicleBuilder(5, 0.025, Direction.LEFT);
    world.entities.push(vehicleBuilder);

    for(let y = 7; y <= 11; y++)
        for(let x = -1; x <= 17; x++)
            world.entities.push(buildWater(x, y));

    let road = buildRoad(0, 1, 17, 5);
    world.entities.push(road);

    let cameraView: Entity = buildCameraView(camera, frog);
    world.entities.push(cameraView);

    world.collisionHandler.pairs["frog"] = ["vehicle", "crocodile", "water", "turtle", "log"];
}

function setup() {
    renderer = new WebGLRenderer();
    scene = new Scene();
    camera = new PerspectiveCamera(FOV_ANGLE, WIDTH / HEIGHT, 0.1, 5000);
    camera.position.x = 8.5;
    camera.position.y = 6.5;
    camera.position.z = 15;

    renderer.setSize(WIDTH, HEIGHT);
    scene.add(camera);

    document.querySelector("body").appendChild(renderer.domElement);

    document.onkeydown = function(event) {
        world.pressKey(event.keyCode);
    };

    document.onkeyup = function(event) {
        world.releaseKey(event.keyCode);
    };

    buildWorld();
}

function worldLoop() {
    world.step();
    world.handleComponents();
    world.handleCollisions();
    world.draw();

    requestAnimationFrame(worldLoop);
}

function main(): void {
    setup();

    requestAnimationFrame(worldLoop);
}