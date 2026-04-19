import Calculator, { greet, farewell as sayGoodbye, VERSION } from '../barrel';
import type { Person } from '../barrel';

new Calculator();
void greet('x');
void sayGoodbye('y');
void VERSION;
const p: Person = { name: 'A', age: 1 };
void p;
