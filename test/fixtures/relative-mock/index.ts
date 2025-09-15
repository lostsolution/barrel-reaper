import type { InterfaceA, InterfaceB } from '../barrel';
import {
    ModuleA,
    ModuleB,
    type TypeA,
    type TypeB,
    a1 as a1LocalRenamed,
    a2,
    a3,
    b1 as b1LocallyRenamed,
    b2,
    b3,
    default as def,
} from '../barrel';
import { b1Renamed, b2Renamed } from '../barrel/index';

void def;
void a1LocalRenamed;
void a2;
void a3;
void b1LocallyRenamed;
void b2;
void b3;
void b2Renamed;
void b1Renamed;
void ModuleA.a1;
void ModuleB.b1;

export type A = TypeA;
export interface IA extends InterfaceA {}

export type B = TypeB;
export interface IB extends InterfaceB {}