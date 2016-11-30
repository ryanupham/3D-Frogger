///<reference path="three.d.ts"/>
// ENGINE

import WebGLRenderer = THREE.WebGLRenderer;
import PerspectiveCamera = THREE.PerspectiveCamera;
import Scene = THREE.Scene;
import Mesh = THREE.Mesh;
import CubeGeometry = THREE.CubeGeometry;
import MeshBasicMaterial = THREE.MeshBasicMaterial;
import Renderer = THREE.Renderer;
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

abstract class Component {
    abstract handle(): void;
}

class Drawable extends Component {
    model: Mesh = null;
    renderer: Renderer;
    scene: Scene;
    parent: Entity;

    handle() {
        this.model.position.x = this.parent.position.x + this.parent.width / 2;
        this.model.position.y = this.parent.position.y;
        this.model.position.z = this.parent.position.z;
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

class Entity {
    type: string;
    visible: boolean = true;
    solid: boolean = true;
    enabled: boolean = true;
    components: Component[] = [];
    width: number;
    height: number;
    position: {x: number, y: number, z: number};
    velocity: {x: number, y: number, z: number} = {x: 0, y: 0, z: 0};
    properties: any;
    world: World;

    customStep: StepFunc = null;
    customCollide: CollideFunc = null;

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

    step() {
        for(let e of this.entities)
            if(e.enabled)
                e.step(this.inputs);
    }

    handleComponents() {
        for(let e of this.entities)
            for(let c of e.components)
                if(!(c instanceof Drawable))
                    c.handle();
    }

    handleCollisions() {
        this.collisionHandler.handleCollisions(this.entities);
    }

    draw() {
        for(let e of this.entities)
            if(e.visible)
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
            if(this.properties.markedForDeath &&this.properties.passiveVelocity.x == 0 &&
                this.properties.passiveVelocity.y == 0 && this.properties.passiveVelocity.z == 0)
                this.world.scripts.killFrog(this); // TODO: die

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
        if(this.properties.jumpDir == Direction.NONE) {
            switch(e.type) {
                // enemies/death zones
                case "vehicle":
                case "crocodile":
                    // TODO: die
                    break;

                case "water":
                    this.properties.markedForDeath = true;
                    break;

                // platforms
                case "turtle":
                case "log":
                    this.properties.passiveVelocity = e.velocity;
                    break;
            }
        }
    };

    let vel: {x: number, y: number, z: number} = {x: 0, y: 0, z: 0};
    let jumpDir: Direction = Direction.NONE;
    let targetSquare: {x: number, y: number} = {x: 0, y: 0};
    let lives: number = 3;

    frog.properties = {passiveVelocity: vel, jumpDir: jumpDir, targetSquare: targetSquare, jumpSpeed: 0.05,
        jumpSteps: 0, jumpProgress: 0, markedForDeath: false, lives: lives};

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x00FF00});
    let mesh: Mesh = new Mesh(new CubeGeometry(frog.width, frog.height, 1), material);
    let drawComp: Drawable = new Drawable(frog, renderer, scene, mesh);
    frog.components.push(drawComp);

    return frog;
}

function buildLog(y: number): Entity {
    let width = 2 + Math.floor(Math.random() * 4);
    let log = new Entity("log", world, width, 1, {x: -width, y: y, z: -1});
    log.velocity.x = 0.025;

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x614126});
    let mesh: Mesh = new Mesh(new CubeGeometry(log.width, log.height, 1), material);
    let drawComp: Drawable = new Drawable(log, renderer, scene, mesh);
    log.components.push(drawComp);

    return log;
}

function buildWater(x: number, y: number): Entity {
    let water = new Entity("water", world, 1, 1, {x: x, y: y, z: -2});

    let material: MeshBasicMaterial = new MeshBasicMaterial({color: 0x40a4df});
    let mesh: Mesh = new Mesh(new CubeGeometry(water.width, water.height, 1), material);
    let drawComp: Drawable = new Drawable(water, renderer, scene, mesh);
    water.components.push(drawComp);

    return water;
}

const WIDTH = 640;
const HEIGHT = 480;

const FOV_ANGLE = 45;

let renderer: WebGLRenderer;
let camera: PerspectiveCamera;
let scene: Scene;

let world: World = new World();

function buildWorld() {
    world.scripts["killFrog"] = (frog: Entity) => {
        frog.properties.lives--;

        if(frog.properties.lives >= 0) {
            frog.position = {x: 8, y: 0, z: 0}
        } else {
            console.log(this);
            // this.scripts.gameOver();
        }
    };

    world.scripts["gameOver"] = () => {
        console.log("game over");
        // TODO: game over
    };

    let frog: Entity = buildFrog();
    world.entities.push(frog);

    let log: Entity = buildLog(6);
    world.entities.push(log);

    for(let y = 6; y <= 10; y++)
        for(let x = -1; x <= 17; x++)
            world.entities.push(buildWater(x, y));

    world.collisionHandler.pairs["frog"] = ["vehicle", "crocodile", "water", "turtle", "log"];
}

function setup() {
    renderer = new WebGLRenderer();
    scene = new Scene();
    camera = new PerspectiveCamera(FOV_ANGLE, WIDTH / HEIGHT, 0.1, 5000);
    camera.position.x = 8.5;
    camera.position.y = 6;
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