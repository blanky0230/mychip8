const demoRom64 = 'YABhAKIiwgEyAaIe0BRwBDBAEgRgAHEEMSASBBIcgEAgECBAgBA=';

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
    mem: Uint8Array; //[]
    stack: Uint8Array; // []
    s: number; // 0x0
    p: number; //0x200
    delayTimer: number;
    soundTimer: number;
    register: Uint8Array; // []
    i: number;
    buffer: Uint8Array;
}

const decodeInto = (instructionWord: number, instruction: Instruction): void => {
    instruction.opcode = Opcode.invalid;
    instruction.word = instructionWord;
    instruction.operand = instruction.reg1 = instruction.reg2 = -1;

    const extractReg1 = () => instruction.reg1 = (instructionWord & 0x0F00) >>> 8;
    const extractReg2 = () => instruction.reg2 = (instructionWord & 0x00F0) >>> 4;

    switch (instructionWord & 0xF000) {
        case 0x6000:
            instruction.opcode = Opcode.mov;
            extractReg1();
            instruction.operand = (instructionWord & 0x00FF);
            break;

        case 0xA000:
            instruction.opcode = Opcode.mvi;
            instruction.operand = (instructionWord & 0x0FFF);
            break;

        case 0xC000:
            instruction.opcode = Opcode.rand;
            extractReg1()
            instruction.operand = (instructionWord & 0x00FF);
            break;

        case 0xD000:
            instruction.opcode = Opcode.sprite;
            extractReg1();
            extractReg2();
            instruction.operand = (instructionWord & 0x000F);
            break;

        case 0x3000:
            //TODO other SKEQs
            instruction.opcode = Opcode.skeq;
            extractReg1();
            instruction.operand = (instructionWord & 0x00FF);
            break

        case 0x7000:
            instruction.opcode = Opcode.add;
            extractReg1();
            instruction.operand = (instructionWord & 0x0FFF);
            break;

        case 0x1000:
            instruction.opcode = Opcode.jmp;
            instruction.operand = (instructionWord & 0x0FFF);
            break;

        default:
            break;
    }

}

const disassemble = (instruction: Instruction): string => {
    switch (instruction.opcode) {
        case Opcode.jmp:
            return `0x1 jmp 0x${instruction.operand.toString(16).padStart(3,'0')}`;

        case Opcode.mov:
            return `0x6 mov v${instruction.reg1.toString(16)} 0x${instruction.operand.toString(16).padStart(2,'0')}`; 

        case Opcode.mvi:
            return `0xA mvi 0x${instruction.operand.toString(16).padStart(3,'0')}`;

        case Opcode.rand:
            return `0xC rand v${instruction.reg1.toString(16)} 0x${instruction.operand.toString(16).padStart(2, '0')}`;
        
        case Opcode.skeq:
            return `0x3 skeq v${instruction.reg1.toString(16)} 0x${instruction.operand.toString(16).padStart(2, '0')}`;

        case Opcode.sprite:
            return `0xD sprite v${instruction.reg1.toString(16)} v${instruction.reg2.toString(16)} 0x${instruction.operand.toString(16).padStart(2, '0')}`;

        case Opcode.add:
            return `0x7 add v${instruction.reg1.toString(16)} 0x${instruction.operand.toString(16).padStart(3,'0')}` 

        default:
            return `0x${instruction.word.toString(16).padStart(4, '0')} invalid!`
    };
}

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

    for(let row = 0; row < instruction.operand; row++) {
        const idx = ((x+row) * 64 ) % 64 * 32;
        const i1 = idx >>> 3;
        const i2 = ((idx >>> 3)+1) & 0xFF;

        const rowOld = ( (state.buffer[i1] << (x & 0x07)) | (state.buffer[i2] >> (8 - (x & 0x07)))  & 0xFF);

        const rowNew = rowOld ^ state.mem[(state.i + row) & 0xFFFF];

        if(~rowNew & rowOld) {
            collision |= 1;
        }

        state.buffer[i1] = (state.buffer[i1] & (0xFF00 >> (x & 0x07)))  | (rowNew >>> (x & 0x07));
        state.buffer[i2] = (state.buffer[i2] & (0xFF >> (x & 0x07))) | (rowNew << (8 - (x & 0x07)));
    }

    state.register[0x0F] = collision;
}

const execute = (instruction: Instruction, state: State): void => {
    const op2 = () => instruction.reg2 === -1 ? instruction.operand : state.register[instruction.reg2];

    switch(instruction.opcode) {
        case Opcode.mov:
            state.register[instruction.reg1] = op2();
            break;

        case Opcode.mvi:
            state.i = instruction.operand;
            break;

        case Opcode.rand:
            state.register[instruction.reg1] = Math.floor(Math.random() * 256) & instruction.operand;
            break;

        case Opcode.skeq:
            if(state.register[instruction.reg1] === op2()) {
                state.p = (state.p + 2) & 0xFFFF;
            }
            break;
    
        case Opcode.sprite:
            drawSprite(instruction, state);
            break;

        case Opcode.add: {
            const result = state.register[instruction.reg1] + op2();
            state.register[instruction.reg1] = result & 0xFF;
            if(instruction.reg2 >= 0) {
                state.register[0x0F] = (result & 0x0100) ? 1 : 0
            }
            break;
        }
        case Opcode.jmp:
            state.p = instruction.operand
            break;


    default:
        throw new Error('invalid instruction');
    }
}

const rom = new Uint8Array(Buffer.from(demoRom64,'base64'));

const state: State = {
    buffer: new Uint8Array(256),
    delayTimer: 0,
    i: 0,
    mem: new Uint8Array(4096),
    p: 0x0200,
    register: new Uint8Array(16),
    s: 0x0000,
    soundTimer: 0,
    stack: new Uint8Array(64),
}

state.mem.subarray(0x0200).set(rom);


const main = () => {
    const currentInstruction: Instruction = {opcode: Opcode.invalid, operand: -1, reg1: -1, reg2: -1, word: -1};

    while(true) {
        const instructionWord = (state.mem[state.p] << 8) | state.mem[(state.p +1) & 0xFFFF];
        state.p = (state.p +2) & 0xFFFF;

        decodeInto(instructionWord, currentInstruction);
        console.log(disassemble(currentInstruction));
        execute(currentInstruction, state);
        console.log(state.register);
        console.log(state.p);

    }
}

main();