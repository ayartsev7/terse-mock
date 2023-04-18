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
The module mainly contains functions for creating and managing mocks/stubs and getting statistics on mocks usage. The most useful of them are:  

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
    <td style="color:DarkRed">tunmock</td>
    <td>removes mocks from data</td>
  </tr>
  <tr style="border-bottom-style:hidden">
    <td style="color:DarkRed">tcalls</td>
    <td>returns call history of mock functions</td>
  </tr>
</table>

terse-mock is covered and tested with Jest so Jest tests will be used in examples below.
### Typical usage
```javascript
import { tmock } from 'terse-mock';

test('some test', () => {
  // ARRANGE
  const mock = tmock('name', [ // create mock
    [m => m.f('some value').data.val, 7], // setup return values
  ]);

  // ACT
  const res = tunmock(sut(mock)); // pass mock to system under test, unmock result

  // ASSERT
  expect(res).toEqual(expectedRes); // check expectations
}
```
Unmocking is required to turn result into plain js type before checking expectations.
## Features

- [Deep automocking](#deep-automocking)

- [Easy setting mock values](#easy-setting-mock-values)

- [Creating functions that return different values per set of arguments](#creating-functions-that-return-different-values-per-set-of-arguments)

- [Stubs](#stubs)

- [Mock interfaces](#mock-interfaces)

- [Call history](#call-history)

- [Automatic spies](#automatic-spies)

- [Using external mocks](#using-external-mocks)

- [Mocking modules](#mocking-modules)

- [And more](#and-more)

## Deep automocking
By default mocks allow to access properties and call functions at any nesting level without first initializing the return values.

Suppose we have [SUT]('https://en.wikipedia.org/wiki/System_under_test'):
```javascript
function sut(data) {
  const r1 = data.getSomething(true).doSomething();
  const r2 = r1.property === 1 ? data.getSomethingElse('a') : null;
  const r3 = data.getSomethingElse('b', true);
  r3.value = 7;

  return {
    prop1: r1.property,
    prop2: r2,
    prop3: r3,
  };
}
```
The shortest test could look like this:
```javascript
test('some test', () => {
  // ARRANGE
  const mock = tmock('data');

  // ACT
  const res = tunmock(sut(mock));

  // ASSERT
  expect(res).toEqual({
    prop1: 'data.getSomething(true).doSomething().property',
    prop2: null,
    prop3: {
      value: 7,
    },
  });
});
```
```
Test Suites: 1 passed, 1 total
```
## Easy setting mock values
Now let's make mock return specific values and write another tests for SUT from [Automocking](#automocking) section:
```javascript
test.each([
  [1, 'something else'],
  [0, null],
])('should return something else in prop2 when property is 1 otherwise null', (property, expectedResult) => {
  // ARRANGE
  const mock = tmock([
    [m => m.getSomething(true).doSomething().property, property],
    [m => m.getSomethingElse('a'), expectedResult],
  ]);

  // ACT
  const res = tunmock(sut(mock));

  // ASSERT
  expect(res.prop2).toEqual(expectedResult);
});
```
## Creating functions that return different values per set of arguments
```javascript
test('different return values per set of arguments', () => {
  // ARRANGE
  const f = tmock([
    [m => m(tm.ANY), 0],
    [m => m(), 1],
    [m => m('a'), 2],
    [m => m('b'), 3],
    [m => m('b', true), 4],
  ]);

  // ASSERT
  expect(f('something')).toEqual(0);
  expect(f()).toEqual(1);
  expect(f('a')).toEqual(2);
  expect(f('b')).toEqual(3);
  expect(f('b', true)).toEqual(4);
});
```
## Stubs
If one need neither automocking nor checking function calls then it worth using stubs rather then mocks. terse-mock stubs are plain js objects, fast and straightford.
```javascript
test('stubs', () => {
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
## Mock interfaces
Generic form of tmock/tstub is available if one need to use benefits like static type checking and code completion   
![Static type checking and code completion](../media/static-type-check.jpg?raw=true)  
  
## Call history
Let's write test that checks call order and arguments of mocked functions for SUT from [Automocking](#automocking) section:
```javascript
test('check calls demo', () => {
  // ARRANGE
  const mock = tmock('data', [
    [m => m.getSomething(true).doSomething().property, 1],
  ]);

  // ACT
  tunmock(sut(mock));

  // ASSERT
  expect(tcalls(mock)).toEqual([ // all calls
    'data.getSomething(true)',
    'data.getSomething(true).doSomething()',
    'data.getSomethingElse("a")',
    'data.getSomethingElse("b", true)',
  ]);
  expect(tcalls(mock.getSomethingElse)).toEqual([ // calls to getSomethingElse
    'data.getSomethingElse("a")',
    'data.getSomethingElse("b", true)',
  ]);
});
```
## Automatic spies
## Using external mocks
## Mocking modules
terse-mock mocks can be used as mocks returned from [Jest module factory for jest.mock()](https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter)
```javascript
import { tmock } from '../src/terse-mock';
jest.mock('some-module', () => tmock('some-module');
jest.mock('some-other-module', () => tmock('some-other-module', [{
  someFunction: () => 'some value',
}]));
```
## And more