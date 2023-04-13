import defaultExport from './module-mocked';
import { function1, function2 } from './module-mocked';

function f() {
  const res = defaultExport();
  res.a = function1();
  res.b = function2('');
  res.c = function1() + function2('');
  return res;
}

export {
  f,
};