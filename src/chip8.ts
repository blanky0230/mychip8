import { OperationCanceledException } from "typescript";

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
            instruction.operand = (instructionWord & 0x0FFF);
            break;
        case 0xD000:
            instruction.opcode = Opcode.sprite;
            instruction.reg1 = (instructionWord & 0x0F00) >>> 8;
            instruction.reg2 = (instructionWord & 0x00F0) >>> 4;
            instruction.operand = (instructionWord & 0x000F);
            break;
        case 0x3000:
            instruction.opcode = Opcode.skeq;
            instruction.reg1 = (instructionWord & 0x0F00) >>> 8;
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
            return `0xC rand v${instruction.reg1.toString(16)} 0x${instruction.operand.toString(16).padStart(3, '0')}`;
        
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

const execute = (instruction: Instruction, state: State): void => {}

const rom = new Uint8Array(Buffer.from(demoRom64,'base64'));

const currentInstruction: Instruction = {opcode: Opcode.invalid, operand: -1, reg1: -1, reg2: -1, word: -1};

for(let i =0; i < rom.length; i+=2) {
    decodeInto((rom[i] << 8) | rom[i+1], currentInstruction);
    console.log(disassemble(currentInstruction));

}
