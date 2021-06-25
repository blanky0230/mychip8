import * as fs from 'fs';
import * as process from 'process';

const FPS = 30;
const INSTRUCTIONS_FRAME = 20;

enum Opcode {
    scdown,
    cls,
    rts,
    scright,
    scleft,
    low,
    high,
    jmp,
    jsr,
    jmi,
    skeq,
    skne,
    mov,
    add,
    or,
    and,
    xor,
    sub,
    shr,
    shl,
    rsb,
    mvi,
    rand,
    sprite,
    xsprite,
    skpr,
    skup,
    gdelay,
    key,
    sdelay,
    ssound,
    adi,
    font,
    xfont,
    bcd,
    str,
    ldr,
    invalid,
}

interface Instruction {
    opcode: Opcode;
    reg1: number;
    reg2: number;
    operand: number;
    word: number;
}

interface State {
    ticks: number;
    time: number;
    mem: Uint8Array; //[]
    stack: Uint16Array; // []
    s: number; // 0x0
    p: number; //0x200
    delayTimer: number;
    soundTimer: number;
    register: Uint8Array; // []
    i: number;
    buffer: Uint8Array;
}

const decodeInto = (
    instructionWord: number,
    instruction: Instruction,
): void => {
    instruction.opcode = Opcode.invalid;
    instruction.word = instructionWord;
    instruction.operand = instruction.reg1 = instruction.reg2 = -1;

    const extractReg1 = () =>
        (instruction.reg1 = (instructionWord & 0x0f00) >>> 8);
    const extractReg2 = () =>
        (instruction.reg2 = (instructionWord & 0x00f0) >>> 4);

    switch (instructionWord & 0xf000) {
        case 0x6000:
            instruction.opcode = Opcode.mov;
            extractReg1();
            instruction.operand = instructionWord & 0x00ff;
            break;

        case 0xa000:
            instruction.opcode = Opcode.mvi;
            instruction.operand = instructionWord & 0x0fff;
            break;

        case 0xc000:
            instruction.opcode = Opcode.rand;
            extractReg1();
            instruction.operand = instructionWord & 0x00ff;
            break;

        case 0xd000:
            instruction.opcode = Opcode.sprite;
            extractReg1();
            extractReg2();
            instruction.operand = instructionWord & 0x000f;
            break;

        case 0x3000:
            //TODO other SKEQs
            instruction.opcode = Opcode.skeq;
            extractReg1();
            instruction.operand = instructionWord & 0x00ff;
            break;

        case 0x7000:
            instruction.opcode = Opcode.add;
            extractReg1();
            instruction.operand = instructionWord & 0x0fff;
            break;

        case 0x2000:
            instruction.opcode = Opcode.jsr;
            instruction.operand = instructionWord & 0x0fff;
            break;

        case 0x1000:
            instruction.opcode = Opcode.jmp;
            instruction.operand = instructionWord & 0x0fff;
            break;

        case 0xf000: {
            extractReg1();
            switch (instructionWord & 0x00ff) {
                case 0x0015:
                    instruction.opcode = Opcode.sdelay;
                    break;

                case 0x0007:
                    instruction.opcode = Opcode.gdelay;
                    break;

                case 0x001e:
                    instruction.opcode = Opcode.adi;
                    break;

                case 0x0065:
                    instruction.opcode = Opcode.ldr;
                    break;
            }
            break;
        }

        case 0x8000: {
            extractReg1();
            extractReg2();
            switch (instructionWord & 0x000f) {
                case 0x0000:
                    instruction.opcode = Opcode.mov;
                    break;

                case 0x0002:
                    instruction.opcode = Opcode.and;
                    break;
            }
            break;
        }

        case 0x0000: {
            if (instructionWord === 0x00e0) {
                instruction.opcode = Opcode.cls;
            }
            if (instructionWord === 0x00ee) {
                instruction.opcode = Opcode.rts;
            }
            break;
        }
        default:
            break;
    }
};

const disassemble = (instruction: Instruction): string => {
    switch (instruction.opcode) {
        case Opcode.jmp:
            return `0x1 jmp 0x${instruction.operand
                .toString(16)
                .padStart(3, '0')}`;

        case Opcode.mov:
            if (instruction.reg2 === -1) {
                return `0x6 mov v${instruction.reg1.toString(
                    16,
                )} 0x${instruction.operand.toString(16).padStart(2, '0')}`;
            }

            return `0x8 mov v${instruction.reg1.toString(
                16,
            )} v${instruction.reg2.toString(16)}`;

        case Opcode.mvi:
            return `0xA mvi 0x${instruction.operand
                .toString(16)
                .padStart(3, '0')}`;

        case Opcode.rand:
            return `0xC rand v${instruction.reg1.toString(
                16,
            )} 0x${instruction.operand.toString(16).padStart(2, '0')}`;

        case Opcode.skeq:
            return `0x3 skeq v${instruction.reg1.toString(
                16,
            )} 0x${instruction.operand.toString(16).padStart(2, '0')}`;

        case Opcode.sprite:
            return `0xD sprite v${instruction.reg1.toString(
                16,
            )} v${instruction.reg2.toString(16)} 0x${instruction.operand
                .toString(16)
                .padStart(2, '0')}`;

        case Opcode.add:
            if (instruction.reg2 === -1) {
                return `0x7 add v${instruction.reg1.toString(
                    16,
                )} 0x${instruction.operand.toString(16).padStart(3, '0')}`;
            }

        case Opcode.and:
            return `0x8 and v${instruction.reg1.toString(
                16,
            )} v${instruction.reg2.toString(16)}`;

        case Opcode.cls:
            return `0x00E0 clear screen`;

        case Opcode.sdelay:
            return `0xf sdelay v${instruction.reg1
                .toString(16)
                .padStart(2, '0')}`;

        case Opcode.jsr:
            return `0x2 jsr ${instruction.operand
                .toString(16)
                .padStart(3, '0')}`;

        case Opcode.gdelay:
            return `0xfr07 gdelay ${instruction.reg1.toString(16)}`;

        case Opcode.rts:
            return `0x00ee rts`;

        case Opcode.adi:
            return `0xF adi v${instruction.reg1.toString(16)}`;

        case Opcode.ldr:
            return `0xF ldr v${instruction.reg1.toString(16)}`;

        default:
            return `0x${instruction.word
                .toString(16)
                .padStart(4, '0')} invalid!`;
    }
};

const drawSprite = (instruction: Instruction, state: State): void => {
    // 8 X N (N = operand)
    // ..aaaaaa bb......
    // ..XXXXXX XX......

    // aaaaaa00 | 000000bb -> aaaaaabb

    // aaaaaabb ^ XXXXXXXX -> AAAAAABB

    // (..aaaaaa & 11000000) | (00AAAAAA) -> ..AAAAAA
    //             |->0xff00 >> (idx % 8)
    //                            |-> AAAAAABB >> (idx % 8)

    // (bb...... & 00111111) | (AAAAAABB << 6)
    //             |-> 0xff >> (idx % 8)
    //                            |-> AAAAAABB << (8 - (idx % 8))

    // ..AAAAAA BB......

    let collision = 0;
    const x = state.register[instruction.reg1];
    const y = state.register[instruction.reg2];

    for (let row = 0; row < instruction.operand; row++) {
        const idx = ((y + row) * 64 + x) % (32 * 64);
        const i1 = idx >>> 3;
        const i2 = ((idx >>> 3) + 1) & 0xff;

        const rowOld =
            ((state.buffer[i1] << (x & 0x07)) |
                (state.buffer[i2] >>> (8 - (x & 0x07)))) &
            0xff;

        const rowNew = rowOld ^ state.mem[(state.i + row) & 0xffff];

        if (~rowNew & rowOld) {
            collision |= 1;
        }

        state.buffer[i1] =
            (state.buffer[i1] & (0xff00 >>> (x & 0x07))) |
            (rowNew >>> (x & 0x07));

        state.buffer[i2] =
            (state.buffer[i2] & (0xff >>> (x & 0x07))) |
            (rowNew << (8 - (x & 0x07)));
    }

    state.register[0x0f] = collision;
};

const execute = (instruction: Instruction, state: State): void => {
    const op2 = () =>
        instruction.reg2 === -1
            ? instruction.operand
            : state.register[instruction.reg2];

    switch (instruction.opcode) {
        case Opcode.mov:
            state.register[instruction.reg1] = op2();
            break;

        case Opcode.mvi:
            state.i = instruction.operand & 0x0fff;
            break;

        case Opcode.rand:
            state.register[instruction.reg1] =
                Math.floor(Math.random() * 256) & instruction.operand;
            break;

        case Opcode.skeq:
            if (state.register[instruction.reg1] === op2()) {
                state.p = (state.p + 2) & 0xffff;
            }
            break;

        case Opcode.sprite:
            drawSprite(instruction, state);
            break;

        case Opcode.add: {
            const result = state.register[instruction.reg1] + op2();
            state.register[instruction.reg1] = result & 0xff;
            if (instruction.reg2 >= 0) {
                state.register[0x0f] = result & 0x0100 ? 1 : 0;
            }
            break;
        }

        case Opcode.and:
            state.register[instruction.reg1] =
                state.register[instruction.reg1] & op2();
            break;

        case Opcode.jmp:
            state.p = instruction.operand;
            break;

        case Opcode.cls:
            state.buffer.fill(0);
            break;

        case Opcode.sdelay:
            state.delayTimer = state.register[instruction.reg1];
            break;

        case Opcode.jsr:
            // console.log(`JSR: ${state.p}`);
            state.stack[state.s] = state.p;
            state.p = instruction.operand;
            state.s = (state.s + 1) & 0xf;
            break;

        case Opcode.gdelay:
            state.register[instruction.reg1] = state.delayTimer;
            break;

        case Opcode.rts:
            state.s = (state.s - 1) & 0xf;
            state.p = state.stack[state.s];
            // console.log(`RTS: ${state.p.toString(16)}`);
            break;

        case Opcode.adi:
            state.i = state.i + state.register[instruction.reg1];
            break;

        case Opcode.ldr:
            for (let i = 0; i <= instruction.reg1; i++) {
                state.register[i] = state.mem[(state.i + i) & 0x0fff];
            }
            break;

        default:
            throw new Error(
                `invalid instruction: ${instruction.word
                    .toString(16)
                    .padStart(4, '0')}`,
            );
    }
};

const render = (state: State) => {
    console.clear();
    for (let row = 0; row < 32; row++) {
        for (let col = 0; col < 64; col++) {
            process.stdout.write(
                state.buffer[8 * row + (col >>> 3)] &
                    (0x01 << (7 - (col & 0x07)))
                    ? '██'
                    : 'XX',
            );
        }
        process.stdout.write('\n');
    }
};

const advanceFrame = (state: State) => {
    const currentInstruction: Instruction = {
        opcode: Opcode.invalid,
        operand: -1,
        reg1: -1,
        reg2: -1,
        word: -1,
    };

    for (let i = 0; i < INSTRUCTIONS_FRAME; i++) {
        const instructionWord =
            (state.mem[state.p] << 8) | state.mem[(state.p + 1) & 0xffff];
        state.p = (state.p + 2) & 0xffff;
        decodeInto(instructionWord, currentInstruction);
        execute(currentInstruction, state);

        state.time += 1000 / FPS / INSTRUCTIONS_FRAME;
        const currentTicks = Math.floor((state.time * 60) / 1000);

        if (currentTicks > state.ticks) {
            state.delayTimer = Math.max(
                state.delayTimer - (currentTicks - state.ticks),
                0,
            );

            state.soundTimer = Math.max(
                state.soundTimer - (currentTicks - state.ticks),
                0,
            );

            state.ticks = currentTicks;
        }
    }
};

const readRom = (path: string) => {
    const file = fs.readFileSync(path);
    return new Uint8Array(file);
};

const main = async () => {
    const state: State = {
        buffer: new Uint8Array(256),
        delayTimer: 0,
        i: 0,
        mem: new Uint8Array(4096),
        p: 0x0200,
        register: new Uint8Array(16),
        s: 0x0000,
        soundTimer: 0,
        time: 0,
        ticks: 0,
        stack: new Uint16Array(16),
    };

    try {
        const newRom = readRom(process.argv[2]);
        state.mem.subarray(0x0200).set(newRom);
    } catch (e) {
        console.error('Error reading file', e);
        process.exit(1);
    }

    let ticks = 0;
    const timebase = Date.now();

    while (true) {
        advanceFrame(state);
        render(state);

        const delta = state.time - (Date.now() - timebase);

        if (delta > 0) {
            await new Promise((r) => setTimeout(r, delta));
        }
    }
};

main();
