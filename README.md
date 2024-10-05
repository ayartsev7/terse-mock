# JS/TS Tests in a Couple of Lines

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![coverage](./badges/coverage-jest%20coverage.svg)

The goal of this project is to make it easier to create mocks and stubs and to reduce the amount of code when writing tests in general.

## Install
npm ([terse-mock on npm](https://www.npmjs.com/package/terse-mock)):

```bash
npm install --save-dev terse-mock
```
yarn

```bash
yarn add --dev terse-mock 
```
## Introduction
terse-mock is intended to use as an addition to existing test frameworks such as [Jest](https://jestjs.io/).  
The module provides a number of functions:  

<table style="line-height:0.7em">
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed;">tmock</td>
    <td style="border: none;">creates mock</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tstub</td>
    <td>creates stub</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tset</td>
    <td>supplements mock or stub</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">treset</td>
    <td>clears mock touches, mock calls and mock values set by sut; clears local options</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tunmock</td>
    <td>removes mock proxies from data</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tinfo</td>
    <td>provides information on mock usage</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tglobalopt, tlocalopt</td>
    <td>sets module options</td>
  </tr>
</table>

terse-mock is tested with Jest so Jest tests are used in examples below.
### Typical usage
```javascript
import { tmock } from 'terse-mock';

test('some test', () => {
  // ARRANGE
  const mock = tmock([ // create mock
    [m => m.prop1.prop2, true], // setup mock value
    [m => m.f('some value').prop3, 7], // setup mock value
    [m => m.f('some other value'), {}], // setup mock value
  ]);

  // ACT
  const res = sut(mock); // pass mock to system under test

  // ASSERT
  const unmockedRes = tunmock(res); // remove possible proxies (optional but strongly recommended)
  expect(unmockedRes).toEqual(expectedResult); // check expectations
});
```
## Features
- [Deep automocking](#deep-automocking)
- [Setting mock values](#setting-mock-values)
- [Stubs](#stubs)
- [Creating functions that return different values per set of arguments](#creating-functions-that-return-different-values-per-set-of-arguments)
- [Interface mocks](#interface-mocks)
- [Call history](#call-history)
- [Automatic spies](#automatic-spies)
- [Using with 3rd party mocks](#using-with-3rd-party-mocks)
- [Module mocks](#module-mocks)
- [Resetting mocks](#resetting-mocks)
- [Other](#other)
  - [Alternative way of setting mock values](#alternative-way-of-setting-mock-values)
  - [Import all at once](#import-all-at-once)
  - [Nested mocks](#nested-mocks)
  - [Collapsing long arguments](#collapsing-long-arguments)
  - [Module options](#module-options)

## Deep automocking
Normally one need to setup all mock values to get sut work.

Suppose we have a [SUT](https://en.wikipedia.org/wiki/System_under_test):
```javascript
function sut(obj) {
  const r1 = obj.getSomething(true).doSomething();
  const r2 = r1 ? obj.getSomethingElse('a').length : null;
  const r3 = obj.getSomethingElse('b', true);

  return {
    prop1: r1,
    prop2: r2,
    prop3: r3,
  };
}

```
The test for the whole return value could be like:
```javascript
test('should return expected result under certain conditions', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.getSomething(true).doSomething(), true],
    [m => m.getSomethingElse('a').length, 1],
    [m => m.getSomethingElse('b', true), 'something'],
  ]);

  // ACT
  const res = sut(mock);

  // ASSERT
  expect(tunmock(res)).toEqual({
    prop1: true,
    prop2: 1,
    prop3: 'something',
  });
});
```
Auto-mocking feature allows you to skip initialisation of mock values without breaking the sut.  
Let's say you want to test only prop1 and don't care about prop2 and prop3.  
Then the test could be like:
```javascript
test('should prop1 have some value under some conditions', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.getSomething(true).doSomething(), true],
  ]);

  // ACT
  const res = sut(mock);

  // ASSERT
  expect(tunmock(res).prop1).toBe(true);
});
```
Or even
```javascript
test('should prop1 have some value under some conditions, shortest test', () => {
  // ARRANGE
  const mock = tmock();

  // ACT
  const res = sut(mock);

  // ASSERT
  expect(tunmock(res).prop1).toBe('<mock>.getSomething(true).doSomething()');
});
```
```
Test Suites: 1 passed, 1 total
```
Here prop1 contains the path it got the value from.
## Setting mock values
For the SUT defined [above](#deep-automocking) make mock return different values for property so we could test all code paths:
```javascript
test.each([
  ['should prop2 have some value under some conditions', true, 10],
  ['should prop2 be null under some other conditions', false, null],
])('%s', (__, doSomethingResult, expectedResult) => {
  // ARRANGE
  const mock = tmock([
    [m => m.getSomething(true).doSomething(), doSomethingResult],
    [m => m.getSomethingElse('a').length, 10],
  ]);

  // ACT
  const res = sut(mock);

  // ASSERT
  expect(tunmock(res).prop2).toBe(expectedResult);
});
```
## Stubs
If one need neither automocking nor checking function calls then it worth using stubs rather then mocks. terse-mock stubs are plain js objects, fast and straightford.
```javascript
test('stub demo', () => {
  // ARRANGE
  const stub = tstub([
    [s => s.a.aa, 0],
    [s => s.f(), 'result'],
    [s => s.b, { bb: 1 }],
  ]);

  // ASSERT
  expect(stub).toEqual({
    a: { aa: 0 },
    f: expect.any(Function),
    b: { bb: 1 },
  });
  expect(stub.f()).toEqual('result');
});
```
## Creating functions that return different values per set of arguments
```javascript
test('function that return different values per set of arguments demo', () => {
  // ARRANGE
  const f = tstub([
    [s => s(TM_ANY), 0],
    [s => s(), 1],
    [s => s('a'), 2],
    [s => s('b'), 3],
    [s => s('b', true), 4],
  ]);

  // ASSERT
  expect(f('something')).toEqual(0);
  expect(f()).toEqual(1);
  expect(f('a')).toEqual(2);
  expect(f('b')).toEqual(3);
  expect(f('b', true)).toEqual(4);
});
```
## Interface mocks
Generic form of `tmock`/`tstub` is available if one wants to use benefits like static type checking and code completion  

![Static type checking and code completion](../media/static-type-check.jpg?raw=true)
## Call history
terse-mock keeps history of function calls. The test below demonstrates how one can check call order and arguments passed to functions:
```javascript
test('checking calls demo', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.f1(), 1],
  ]);

  // ACT
  mock.f1();
  mock.prop.f2(mock.a.b.c, false);
  mock.prop.f2({ b: 'bbb' });

  // ASSERT
  expect(tinfo().callLog).toEqual([ // log of all calls
    'mock.f1()',
    'mock.prop.f2(mock.a.b.c, false)',
    'mock.prop.f2({...})',
  ]);
  expect(tinfo(mock.prop.f2).calls[1][0]).toEqual({ // examine arguments of a particular call
    b: 'bbb',
  });
});
```
This also can be useful for debugging purposes to examine all calls fo mocked functions in sut.
## Automatic spies
terse-mock automatically creates spies for js functions found in values passed to `tmock` and `tset`. Calls to this functions get to call log and can be analyzed with `tinfo`.
```javascript
test('automatic spies demo', () => {
  // ARRANGE
  const obj = {
    nestedObj: {
      f: function (n) { return n > 7 },
    },
  };
  const mock = tmock([m => m.obj, obj]);

  // ASSERT
  expect(mock.obj.nestedObj.f(7)).toBe(false);
  expect(mock.obj.nestedObj.f(8)).toBe(true);
  expect(tinfo(mock).callLog).toEqual([
    '<mock>.obj.nestedObj.f(7)',
    '<mock>.obj.nestedObj.f(8)',
  ]);
});
```
## Using with 3rd party mocks
terse-mock can use 3rd party mocks to analyze calls to mocked functions. To do so one need to create adapter for 3rd party mock by implementing `IExternalMock` interface provided by the module and pass the adapter to `tmock`. The test demonstrates how to use Jest mocks for call analyzing:
```javascript
const jestMock: IExternalMock = {
  create: () => jest.fn(),
};

test('Use Jest function to analyze calls to mocked functions demo', () => {
  // ARRANGE
  tlocalopt({ externalMock: jestMock });
  const mock = tmock();

  // ACT
  mock.f(7);

  // ASSERT
  const externalMockForF = tinfo(mock.f).externalMock;
  expect(externalMockForF).toBeCalledTimes(1);
  expect(externalMockForF).toBeCalledWith(7);
});
```
3rd party mocks can also be used as return values for terse-mock mocks:
```javascript
test('Using Jest function as mock value demo', () => {
  // ARRANGE
  const jestFn = jest.fn();
  const mock = tmock({ f: jestFn });

  // ACT
  mock.f();

  // ASSERT
  expect(mock.f).toBeCalledTimes(1);
});
```
## Module mocks
terse-mock mocks can be used as return values from [Jest module factory for jest.mock()](https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter)  
Please note that the example below uses the [alternative way](#alternative-way-of-setting-mock-values) of setting mock values, as it is well suited for such cases.
```javascript
jest.mock('some-module', () => tmock('some-module', {
  someFunction: () => 'some value',
}));
```
Another example with expectation on mocked module function calls:
```javascript
jest.mock('./module', () => tmock());
import { someFunction } from './module';
import { sut } from './sut-that-uses-module';

test('should call someFunction', () => {
  // ACT
  sut();

  // ASSERT
  expect(tinfo(someFunction).calls.length > 0).toBe(true);
});
```
## Resetting mocks
Mock or any of its part can be reset by `treset`. That means that all mock touches, mock calls and mock values that were setup outside `tmock` and `tset` (e.g in sut) are cleared out from mock while values setup by `tmock` and `tset` persist. Calling `treset` with *mock* argument will also reset all nested mocks.
```javascript
test('reset mocks demo', () => {
  // ARRANGE
  const mock = tmock([m => m.p.pp, 'val']);

  // Oparate mock in sut.
  mock.p = {}; // Replace value.
  mock.a.f().c = true; // Add new value.
  mock.b; // Touch.
  expect(tunmock(mock)).toEqual({ // Unmock to observe all mock values at once
    p: {},
    a: {
      f: expect.any(Function),
    },
    b: '<mock>.b',
  });

  // ACT
  treset(mock);

  // ASSERT
  expect(tunmock(mock)).toEqual({
    p: {
      pp: 'val',
    },
  });
});
```
## Other
Some of minor features are listed below. Examine [terse-mock tests](https://github.com/ayartsev7/terse-mock/tree/main/tests) for the rest of features and examples.
### Alternative way of setting mock values
Besides setup tuples there is another way of setting mock values: initialization object. This option is well suited for [module mocks](#module-mocks).
```javascript
test('two ways of setting mock values demo', () => {
  // ARRANGE
  const stub = tstub([
    { // with object
      a: 'value for a', // equivalent to tuple [s => s.a, 'value for a']
    },
    [s => s.b, 'value for b'], // with tuple
    [s => s.c, 'value for c'], // with tuple
  ]);

  // ASSERT
  expect(stub).toEqual({
    a: 'value for a',
    b: 'value for b',
    c: 'value for c',
  });
});
```
### Import all at once
Module has default export with all module functions and constants.  
Instead of
```javascript
import { tmock, TM_ANY } from 'terse-mock';

const mock = tmock([m => m.f(TM_ANY), 1]);
```
one can write
```javascript
import tm from 'terse-mock';

const mock = tm.mock([m => m.f(tm.ANY), 1]);
```
### Nested mocks
terse-mock mocks can be freely used as mock values in `tmock` and `tset`.
```javascript
test('nested mocks demo', () => {
  // ARRANGE
  const mock = tmock([
    [m => m.nestedMock, tmock([ // nested mock
      [mm => mm.prop1, 1],
    ])],
    [m => m.prop, 'val'],
  ]);
  mock.nestedMock.anotherProp = 5;

  // ASSERT
  expect(mock.nestedMock.prop1).toBe(1);
  expect(mock.nestedMock.anotherProp).toBe(5);
  expect(tunmock(mock)).toEqual({
    nestedMock: {
      prop1: 1,
      anotherProp: 5,
    },
    prop: 'val',
  });
});
```
### Collapsing long arguments
By default module machinery shorten string representation of mock touches - it collapses the contents of objects, arrays and long mocks in functions arguments. If you need to see the contents of collapsed data, you can use the `collapseLongValues` option. Use `collapseThreshold` option to set the string length threshold after which the data will be collapsed.
```javascript
test('collapsed output enabled/disabled demo', () => {
  // ARRANGE
  tlocalopt({
    collapseLongValues: true,
    collapseThreshold: 6,
  });

  // ACT
  const result = tmock().f(
    tmock('a').f(1), // length of 'a.f(1)' is 6
    { a: 1 }, // length of '{a: 1}' is 6
    [1, 2], // length of '[1, 2]' is 6
    tmock('aa').f(1), // length of 'aa.f(1)' > 6
    { a: 11 }, // length of '{a: 11}' > 6
    [1, 2, 3], // length of '[1, 2, 3]' > 6
  );

  // ASSERT
  expect(tunmock(result)).toBe('<mock>.f(a.f(1), {a: 1}, [1, 2], <...>, {...}, [...])');
});
```
### Module options
`tglobalopt` allows to customise module settings e.g. to set default name for mocks or turn automocking on/of.  
`tlocalopt` allows to override module settings temporarly untill the `treset` is called.

```javascript
test('module options demo', () => {
  // ARRANGE
  tglobalopt({
    defaultMockName: 'newDefaultMockName',
  })
  const mock = tmock();

  // ACT
  const res = tunmock(mock.a);

  // ASSERT
  expect(res).toBe('newDefaultMockName.a');
});
```