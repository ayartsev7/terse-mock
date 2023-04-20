import { tm, tset, treset, tmock, tunmock, tinfo, tcalls, tglobalopt, IExternalMock, InitCouple, AnyInitializer } from '../src/terse-mock';

const jestMock: IExternalMock = {
  create: () => jest.fn(),
};

const SCALARS = [
  0,
  1,
  -1,
  1e-1,
  NaN,
  Infinity,
  -Infinity,
  true,
  false,
  undefined,
  null,
  '',
  'a b',
  Symbol(),
  Symbol('a'),
];

const DFAULT_NUMERIC_VALUE = 1;

const FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE = [
  () => DFAULT_NUMERIC_VALUE,
  (a: any, b: any) => DFAULT_NUMERIC_VALUE, // eslint-disable-line @typescript-eslint/no-unused-vars
  function f() { return DFAULT_NUMERIC_VALUE; },
  function () { return DFAULT_NUMERIC_VALUE; },
  new Function(`return ${DFAULT_NUMERIC_VALUE}`),
  //jest.fn(() => DFAULT_NUMERIC_VALUE),
];

const testSymbol = Symbol('testSymbol');
const objectWithTestSymbolProperty = {};
objectWithTestSymbolProperty[testSymbol] = DFAULT_NUMERIC_VALUE;
const objectWithoutPrototypeWithProperty = Object.create(null);
objectWithoutPrototypeWithProperty.a = DFAULT_NUMERIC_VALUE;

const OBJECTS_AND_ARRAYS = [
  objectWithTestSymbolProperty,
  Object.create(null),
  objectWithoutPrototypeWithProperty,
  {},
  { a: [1, 2, 3] },
  [],
  [{}, 7, { a: 1 }],
  new RegExp('a'),
];

test('all exported functions should have analogues in tm', () => {
  // ASSERT
  expect(tm.set).toBe(tset);
  expect(tm.reset).toBe(treset);
  expect(tm.mock).toBe(tmock);
  expect(tm.unmock).toBe(tunmock);
  expect(tm.info).toBe(tinfo);
  expect(tm.calls).toBe(tcalls);
  expect(tm.globalopt).toBe(tglobalopt);
});

describe('-------------------- tglobalopt ----------------------', () => {
  test('should accept empty options', () => {
    // ACT
    const globalOptions = tglobalopt();

    // ASSERT
    expect(globalOptions).toEqual({
      defaultMockName: 'mock',
      simplifiedOutputEnabled: true,
      automockEnabled: true,
    });
  });

  test('should be merged options passed to tglobalopt', () => {
    // ACT
    const globalOptionsBackup = tglobalopt();
    const globalOptions = tglobalopt({
      defaultMockName: 'mock name',
      simplifiedOutputEnabled: false,
    });

    // ASSERT
    expect(globalOptions).toEqual({
      defaultMockName: 'mock name',
      simplifiedOutputEnabled: false,
      automockEnabled: true,
    });

    tglobalopt(globalOptionsBackup); // restore global options
  });
});

describe('----------------------- tmock arguments ------------------------', () => {
  test('should accept empty arguments list', () => {
    expect(() => tmock()).not.toThrow();
  });

  test('should accept name as first argument', () => {
    // ACT
    const mock = tmock('mockName');

    // ASSERT
    expect(tunmock(mock)).toBe('mockName');
  });

  test('should accept init tuple as first or second argument', () => {
    // ARRANGE
    const initCouple: InitCouple = [(m) => m.a, 1];

    // ACT
    const mock1 = tmock(initCouple);
    const mock2 = tmock('', initCouple);

    // ASSERT
    expect(tunmock(mock1.a)).toBe(1);
    expect(tunmock(mock2.a)).toBe(1);
  });

  test('should accept array of initializers as first or second argument', () => {
    // ARRANGE
    const initializers: AnyInitializer[] = [
      { a: 1 },
      [(m) => m.b, 3],
    ];

    // ACT
    const mock1 = tmock(initializers);
    const mock2 = tmock('', initializers);

    // ASSERT
    const unmockedInitializers = {
      a: 1,
      b: 3,
    };
    expect(tunmock(mock1)).toEqual(unmockedInitializers);
    expect(tunmock(mock2)).toEqual(unmockedInitializers);
  });

  test('should accept options as first or second or third argument', () => {
    // ARRANGE
    const options = { defaultMockName: 'mockName' };

    // ACT
    const mock1 = tmock(options);
    const mock2 = tmock('', options);
    const mock3 = tmock('', [], options);

    // ASSERT
    expect(tunmock(mock1)).toBe('mockName');
    expect(tunmock(mock2)).toBe('mockName');
    expect(tunmock(mock3)).toBe('mockName');
  });

  test('should accept generic form', () => {
    // ARRANGE
    interface I {
      a: number;
    }

    // ACT + ASSERT
    tm.mock<I>('', [{ a: 1 }]),
    tm.mock<Object>('', [[(m) => m.toString, () => '']]),
    tm.mock<I>('', [
      { a: 1 },
      [(m) => m.a, 1],
    ]);
    tm.mock<I>([{ a: 1 }]),
    tm.mock<I>([[(m) => m.a, 1]]),
    tm.mock<I>([
      { a: 1 },
      [(m) => m.a, 1],
    ]);
  });

  test('should throw when more then one initializer argument provided', () => {
    expect(() => tmock([], [])).toThrowError('tmock: multiple initializer arguments not allowed');
  });

  test('should throw when more then one options argument provided', () => {
    expect(() => tmock({}, {})).toThrowError('tmock: multiple options arguments not allowed');
    expect(() => tmock('', {}, {})).toThrowError('tmock: multiple options arguments not allowed');
  });
});

describe('----------------------- tmock options ------------------------', () => {
  describe('name', () => {
    test('should use default name if name is not provided', () => {
      // ARRANGE
      const mock = tmock();

      // ASSERT
      expect(tunmock(mock.a)).toBe('mock.a');
    });

    test('should use name if name is provided', () => {
      // ARRANGE
      const mock = tmock({ defaultMockName: 'name' });

      // ASSERT
      expect(tunmock(mock.a)).toBe('name.a');
    });

    test('should remove leading comma if name is an empty string', () => {
      // ARRANGE
      const mock = tmock({ defaultMockName: '' });

      // ASSERT
      expect(tunmock(mock.a)).toBe('a');
    });
  });

  describe('externalMock', () => {
    test('should consider calls of explicitly defined functions', () => {
      // ARRANGE
      const mock = tmock([
        {
          f1: function () {},
          f2: function () {},
          p: {
            f3: () => undefined,
          },
          f4: [new Function()],
        },
        [m => m.p.f5, new Function()],
        [m => m.f6, function () {}],
      ], { externalMock: jestMock });

      // ACT
      mock.f2();
      mock.p.f3();
      mock.p.f3(1);
      mock.p.f3(() => undefined, undefined);
      mock.f4[0](true, false);
      mock.p.f5('');
      mock.f6();

      // ASSERT
      const res = tunmock(mock)
      expect(tinfo(res.f1).externalMock).not.toBeCalled();
      expect(tinfo(res.f2).externalMock).toBeCalledTimes(1);
      expect(tinfo(res.p.f3).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(res.f4[0]).externalMock.mock.calls).toEqual([[true, false]]);
      expect(tinfo(res.p.f5).externalMock.mock.calls).toEqual([['']]);
      expect(tinfo(res.f6).externalMock).toBeCalledTimes(1);
    });

    test('should consider calls of functions that were not explicitly defined', () => {
      // ARRANGE
      const mock = tmock({ externalMock: jestMock });

      // ACT
      mock.f1();
      mock.p.f2();
      mock.p.f2(1);
      mock.p.f2(() => undefined, undefined);
      mock.q[0](true, false);

      // ASSERT
      const res = tunmock(mock);
      expect(tinfo(res.f1).externalMock).toBeCalledTimes(1);
      expect(tinfo(res.p.f2).externalMock.mock.calls).toEqual([[], [1], [expect.any(Function), undefined] ]);
      expect(tinfo(res.q[0]).externalMock.mock.calls).toEqual([[true, false]]);
    });
  });

  describe('simplifiedOutput', () => {
    test.each([
      [1, 'mock(1)', 'mock(1)'],
      [{}, 'mock({})', 'mock({})'],
      [{ '0': 7 }, 'mock({0: 7})', 'mock({...})'],
      [{ a: '7', b: 0 }, 'mock({a: "7", b: 0})', 'mock({...})'],
      [[], 'mock([])', 'mock([])'],
      [[1], 'mock([1])', 'mock([...])'],
      [[`1`, true, {}], 'mock(["1", true, {}])', 'mock([...])'],
      [new Function(), 'mock(function anonymous)', 'mock(function anonymous)'],
      [() => undefined, 'mock(arrow function)', 'mock(arrow function)'],
      [function () { return null; }, 'mock(function)', 'mock(function)'],
      [function f() { return null; }, 'mock(function f)', 'mock(function f)'],
    ])('should simplify output %#', (arg, expectedResult, expectedResultSimplified) => {
      // ARRANGE
      const mock = tm.mock({ simplifiedOutputEnabled: false });
      const mockSimplifiedOutput = tm.mock({ simplifiedOutputEnabled: true });

      // ACT
      const res = mock(arg);
      const resSimple = mockSimplifiedOutput(arg);

      // ASSERT
      expect(tm.unmock(res)).toEqual(expectedResult);
      expect(tm.unmock(resSimple)).toEqual(expectedResultSimplified);
    });

    test('should simplify nested mocks', () => {
      // ARRANGE
      const innerMock = tm.mock('innerMock', [{ a: 7 }]);
      const mock = tm.mock({ simplifiedOutputEnabled: false });
      const mockSimplifiedOutput = tm.mock({ simplifiedOutputEnabled: true });

      // ACT
      const res = mock(innerMock);
      const resSimple = mockSimplifiedOutput(innerMock);

      // ASSERT
      expect(tm.unmock(res)).toEqual('mock({a: 7})');
      expect(tm.unmock(resSimple)).toEqual('mock(innerMock)');
    });
  });

  describe('automock', () => {
    test('should return proxy when automock enabled for not explicitly mocked', () => {
      // ACT
      const mock = tmock({ automockEnabled: true });

      // ASSERT
      expect(typeof mock.a).toBe('function');
    });

    test('should return undefined when automock disabled for not explicitly mocked', () => {
      // ACT
      const mock = tmock({ automockEnabled: false });

      // ASSERT
      expect(mock.a).toBeUndefined();
    });
  });
});

describe('-------------------- mock behavior ----------------------', () => {
  test('expect with tmock argument should not crash', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(mock).toBeDefined();
  });

  test('should be callable', () => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock();

    // ASSERT
    const res = tm.unmock(mock);
    expect(res).toEqual(expect.any(Function));
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
  ])('should return predefined scalars, objects and arrays %#', (initialStub) => {
    // ARRANGE
    const mock = tm.mock([{ a: initialStub }]);

    // ACT + ASSERT
    expect(mock.a).toEqual(initialStub);
  });

  test('should return predefined jest mocks as is', () => {
    // ARRANGE
    const jestMock = jest.fn();
    const mock = tm.mock([{ a: jestMock }]);

    // ACT + ASSERT
    expect(mock.a).toBe(jestMock);
  });

  test('should return predefined classes as is', () => {
    // ARRANGE
    class A {};
    const a = new A();
    const mock = tm.mock([{
      class: a,
    }]);

    // ASSERT
    expect(mock.class).toBe(a);
  });

  test.each([
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(() => DFAULT_NUMERIC_VALUE),
  ])('should be able to call functions and access predefined function properties %#', (initialStub) =>
  {
    // ARRANGE
    const s = Symbol('s');
    (initialStub as any).a = 3;
    (initialStub as any)[s] = 'sss';

    // ACT
    const mock = tm.mock([{ f: initialStub }]);

    // ASSERT
    expect(mock.f()).toBe(DFAULT_NUMERIC_VALUE);
    expect(mock.f.a).toBe(3);
    expect(mock.f[s]).toBe('sss');
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should preserve assigned values as is', (val) => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock.a = val;

    // ASSERT
    expect(mock.a).toBe(val);
  });

  test('values assigned to mock should override predefined values', () => {
    // ARRANGE
    const mock = tm.mock([{ a: 1 }]);
    tset(mock, [(m) => m.b, 3]);
    tset(mock, [(m) => m.c.cc, 5]);

    // ACT
    mock.a = 'a';
    mock.b = 'b';
    mock.c.cc = undefined;

    // ASSERT
    expect(mock.a).toBe('a');
    expect(mock.b).toBe('b');
    expect(mock.c.cc).toBeUndefined();
  });

  test('should allow to assign function properties and function should remain callable', () => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock.a.b.c = null;
    mock.a(1).b.c = [1];

    // ASSERT
    expect(mock.a.b.c).toBe(null);
    expect(mock.a(1).b.c).toEqual([1]);
    const res = tm.unmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a.b.c).toBe(null);
    expect(res.a(1).b.c).toEqual([1]);
  });

  test('mock should allow to call function and then assign function properties', () => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    mock.a(1).b.c = [1];
    mock.a.b.c = null;

    // ASSERT
    expect(mock.a(1).b.c).toEqual([1]);
    expect(mock.a.b.c).toBe(null);
    const res = tm.unmock(mock);
    expect(res).toEqual({ a: expect.any(Function) });
    expect(res.a(1).b.c).toEqual([1]);
    expect(res.a.b.c).toBe(null);
  });

  test('should call both original function and external mock', () => {
    // ARRANGE
    const mock = tmock([{ f: jest.fn() }], { externalMock: jestMock });
    // tset(mock, [(m) => m.f(7), 3]); // TODO: explore this case

    // ACT
    mock.f();
    mock.f(7);

    // ASSERT
    const res = tunmock(mock);

    expect(res.f).toBeCalledTimes(2);
    expect(tinfo(res.f).externalMock).toBeCalledTimes(2);
  });

  test('should return empty array for spread operator', () => {
    // ARRANGE
    const mock = tmock();

    // ACT
    const res = [...mock];

    // ASSERT
    expect(res).toEqual([]);
  });
});

describe('-------------------- tstub ----------------------', () => {
  test('should accept object as argument', () => {
    // ACT
    const stub = tm.stub({ a: 1 });

    // ASSERT
    expect(stub).toEqual({ a: 1 });
  });

  test('should accept init couple as argument', () => {
    // ACT
    const stub = tm.stub([(s) => s.a, 1]);

    // ASSERT
    expect(stub).toEqual({ a: 1 });
  });

  test('should accept generic form', () => {
    // ARRANGE
    interface I {
      a: number;
      b: string;
    }
    // ASSERT
    tm.stub<string>([(s) => s.length, 1]);
    tm.stub<I>({ b: '1' });
    tm.stub<I>([
      { a: 1 },
      [(s) => s.b, 'a'],
    ]);
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    jest.fn(),
  ])('should replace values', (originalValue) => {
    // ACT
    const stub = tm.stub([
      {
        a: originalValue,
      },
      [(s) => s.a, 'aaa'],
      [(s) => s.f(), originalValue],
      [(s) => s.f(), 'bbb'],
    ]);

    // ASSERT
    expect(stub.a).toBe('aaa');
    expect(stub.f()).toBe('bbb');
  });

  test('should replece scalar with object when setting up property of scalar', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.a, 1],
      [(s) => s.a.aa, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toEqual({ aa: 'aa' });
  });

  test('should replece all prior setups', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.a.aa, {} ],
      [(s) => s.a.aa.aaa, 1 ],
      [(s) => s.a.bb, 3 ],
      [(s) => s.a, 'aa'],
    ]);

    // ASSERT
    expect(stub.a).toBe('aa');
  });

  test('should merge to objects', () => {
    // ACT
    const stub = tm.stub([
      {
        a: { aa: 1, bb: 3, cc: { ccc: 5 }},
        b: Object.create(null),
      },
      [(s) => s.a.cc.ddd, 7],
      [(s) => s.c.cc, undefined],
      [(s) => s.d, ''],
    ]);

    // ASSERT
    expect(stub).toEqual({
      a: {
        aa: 1,
        bb: 3,
        cc: {
          ccc: 5,
          ddd: 7,
        },
      },
      b: {},
      c: {
        cc: undefined,
      },
      d: '',
    });
  });

  test('should combine return values of functions in stub', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.f(1), 5],
      [(s) => s.f(3), 7],
      [(s) => s.g(1, 3), 'bbb'],
      [(s) => s.g(tm.ANY), 'aaa'],
    ]);

    // ASSERT
    expect(stub.f(1)).toBe(5);
    expect(stub.f(3)).toBe(7);
    expect(stub.f()).toBe(undefined);

    expect(stub.g(1, 3)).toBe('bbb');
    expect(stub.g(1)).toBe('aaa');
  });

  test('should merge return values and properties of functions in stub', () => {
    // ACT
    const stub = tm.stub([
      [(s) => s.f.prop1, '1'],
      [(s) => s.f(1), { b: 3 }],
      [(s) => s.f(1).a.bb, 5],
      [(s) => s.f.prop2, null],

      [(s) => s.f1, function () { return 1; }],
      [(s) => s.f1.prop, 7 ],
      [(s) => s.f1(), 'aaa' ],
    ]);

    // ASSERT
    expect(stub.f(1)).toEqual({
      a: {
        bb: 5,
      },
      b: 3,
    });
    expect(stub.f.prop1).toBe('1');
    expect(stub.f.prop2).toBe(null);

    expect(stub.f1()).toBe('aaa');
    expect(stub.f1.prop).toBe(7);    
  });

  test('should throw error when trying to replace stub at root level', () => {
    // ASSERT
    expect(() => tm.stub([(s) => s, 1])).toThrowError('Cannot replace stab root');
  });
});

describe('-------------------- tunmock ---------------------', () => {
  test.each([
    ...SCALARS,
    ...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE,
    new RegExp(''),
    jest.fn(),
  ])('should keep scalars, functions and classes as is %#', (value) => {
    // ARRANGE
    const mock = tmock();
    mock.value = value;

    // ACT
    const res = tunmock(mock.value);

    // ASSERT
    expect(res).toBe(value);
  });

  test('should unmock mocks recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.prop, tmock('nestedMockLevel1', [
        [(m) => m.prop, tmock('nestedMockLevel2', [
          [(m) => m.prop, 'value'],
          [(m) => m.prop1, tmock()],
        ])],
      ])],
    ]);

    mock.prop.prop.prop2 = 'prop assigned by sut';

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      prop: {
        prop: {
          prop: 'value',
          prop1: 'mock',
          prop2: 'prop assigned by sut',
        },
      },
    });
  });

  test('should unmock arrays recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.prop,
        [
          1,
          [3],
          tmock(),
          { a: 1 },
          undefined,
          null,
        ]
      ],
    ]);

    mock.prop.push('aaa');

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      prop: [
        1,
        [3],
        'mock',
        { a: 1 },
        undefined,
        null,
        'aaa',
      ],
    });
  });

  test('should return original functions with properties copied from mock', () => {
    // ARRANGE
    function f () {}
    const mock = tmock('some mock', [
      [(m) => m.f, f],
    ]);

    mock.f.prop = 1;

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(Object.create(f.prototype) instanceof res.f).toBe(true);
    expect(res.f.prop).toBe(1);
  });

  test('should return functions for function mocks with properties preserved', () => {
    // ARRANGE
    const mock = tmock('some mock', [
      [(m) => m.f(), 1],
    ]);

    const s = Symbol('s');
    mock.f.prop = 1;
    mock.f[s] = '1';
    mock.g();
    mock.g.prop = 3;
    mock.g()[s] = '3';

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res.f).toStrictEqual(expect.any(Function));
    expect(res.f()).toBe(1);
    expect(res.f.prop).toBe(1);
    //expect(res.f[s]).toBe('1'); // TODO: support symbols
    expect(res.g).toStrictEqual(expect.any(Function));
    expect(res.g.prop).toBe(3);
    //expect(res.g[s]).toBe('3'); // TODO: support symbols
  });

  test('should unmock objects recursively', () => {
    // ARRANGE
    const mock = tmock([
      [(m) => m.o, {
        a: tmock(),
      }],
    ]);
    mock.b = 7;

    // ACT
    const res = tunmock(mock);

    // ASSERT
    expect(res).toEqual({
      o: {
        a: 'mock',
      },
      b: 7,
    });
  });
});

describe('-------------------- tset ---------------------', () => {
  test('should not allow to mock at root level', () => {
    // ARRANGE
    const mock = tmock();

    // ACT + ASSERT
    expect(() => tset(mock, [(m) => m, 1])).toThrowError('Mocking at root level is not allowed');
  });

  test.each([
    (m) => m.a,
    (m) => m.a.b.c,
    (m) => m.b[3],
    (m) => m(),
    (m) => m()(),
    (m) => m.f(),
    (m) => m.a.f(),
    (m) => m.f().a,
    (m) => m.f().g(),
    (m) => m.f()(),
    (m) => m.f()().a,
    (m) => m.f().a.g().h,
  ])('should set mock values %#', (initExpression) => {
    // ARRANGE
    const mock = tmock();

    // ACT
    tset(mock, [initExpression, 1]);

    // ASSERT
    expect(initExpression(mock)).toBe(1);
  });

  test.each([
    ...SCALARS,
    ...OBJECTS_AND_ARRAYS,
    new RegExp(''),
  ])('should return mock values for scalars, objects, arrays and classes', (value) => {
    // ARRANGE
    const mock = tm.mock();
    tset(mock, [(m) => m.a, value]);

    // ACT
    const result = mock.a;

    // ASSERT
    expect(result).toEqual(value);
  });

  test('should return function that calls original function internally', () => {
    // ARRANGE
    const jestFunction = jest.fn();
    function f() {
      jestFunction();
      return 1;
    };
    const mock = tm.mock();
    tset(mock, [(m) => m.a, f]);

    // ACT
    mock.a();
    const result = mock.a();

    // ASSERT
    expect(result).toBe(1);
    expect(jestFunction).toBeCalledTimes(2);
  });

  test('should override values', () => {
    // ARRANGE
    const mock = tm.mock([{ a: 0 }]);

    // ACT + ASSERT
    tset(mock, [(m) => m.a, 1]);
    tset(mock, [(m) => m.a, 2]);
    expect(mock.a).toBe(2);

    tset(mock, [(m) => m.b.c, 1]);
    tset(mock, [(m) => m.b, 2]);
    expect(mock.b).toBe(2);
    expect(mock.b.c).toBeUndefined();

    tset(mock, [(m) => m['c'], 1]);
    tset(mock, [(m) => m['c']['d'], 2]); // TODO: is his behavior ok?
    expect(mock.c).not.toBe(1);
    expect(mock.c.d).toBe(2);

    tset(mock, [(m) => m.array[0], 1]);
    tset(mock, [(m) => m.array[0], 2]);
    expect(mock.array[0]).toBe(2);

    tset(mock, [(m) => m.f(1), 1]);
    tset(mock, [(m) => m.f(1), 2]);
    expect(mock.f(1)).toBe(2);

    tset(mock, [(m) => m.f(1), 1]);
    tset(mock, [(m) => m.f(1).a, 2]);
    expect(mock.f(1)).not.toBe(1);
    expect(mock.f(1).a).toBe(2);

    tset(mock, [(m) => m.f().a, 1]);
    tset(mock, [(m) => m.f(), 2]);
    expect(mock.f().a).toBeUndefined();
    expect(mock.f()).toBe(2);

    tset(mock, [(m) => m.f.a, 1]);
    tset(mock, [(m) => m.f.b, 2]);
    tset(mock, [(m) => m.f(), undefined]);
    tset(mock, [(m) => m.f.b, 3]);
    expect(mock.f.a).toBe(1);
    expect(mock.f.b).toBe(3);

    tset(mock, [(m) => m.f(), 1]);
    tset(mock, [(m) => m.f()(), 2]);
    expect(mock.f()).not.toBe(1);
    expect(mock.f()()).toBe(2);

    tset(mock, [(m) => m.f()(), 1]);
    tset(mock, [(m) => m.f(), 2]);
    expect(() => mock.f()()).toThrowError('mock.f(...) is not a function');
    expect(mock.f()).toBe(2);

    tset(mock, [(m) => m.a, 2]);
    tset(mock, [(m) => m.a.f(), 2]);
    tset(mock, [(m) => m.a.f().g, 3]);
    expect(mock.a.f().g).toBe(3);

    tset(mock, [(m) => m.a, 2]);
    tset(mock, [(m) => m.a.f(), 2]);
    tset(mock, [(m) => m.a.f().g(), 3]);
    expect(mock.a.f().g()).toBe(3);
  });

  test('should return value setup for tm.ANY for unknown arguments', () => {
    // ARRANGE
    const mock = tmock([
      [m => m.f(3), '333' ],
      [m => m.f(tm.ANY), 'aaa' ],
      [m => m.f(5), '555' ],
      [m => m.f(tm.ANY.toString()), '777' ],
    ]);

    // ASSERT
    expect(mock.f(3)).toBe('333');
    expect(mock.f(5)).toBe('555');
    expect(mock.f(tm.ANY.toString())).toBe('777');
    expect(mock.f()).toBe('aaa');
    expect(mock.f(777)).toBe('aaa');
    expect(mock.f(3, 5)).toBe('aaa');
  });

  test('mocked function should return predefined values for particular arguments, otherwise automock value', () => {
    // ARRANGE
    const mock = tmock();
    tset(mock, [(m) => m.f('a'), 1]);

    // ACT
    mock.f('a');
    mock.f('b');

    // ASSERT
    const res = tunmock(mock);
    expect(res.f()).toBe(undefined);
    expect(res.f('a')).toBe(1);
    expect(res.f('b')).toBe('mock.f("b")');
  });

  test('should mock call result per set of call arguments', () => {
    // ARRANGE
    const mock = tm.mock();

    // ACT
    tset(mock, [(m) => m.f(), 'f()']);
    tset(mock, [(m) => m.f(1), 'f(1)']);
    tset(mock, [(m) => m.f(0), 'f(0)']);
    tset(mock, [(m) => m.f(-1), 'f(-1)']);
    tset(mock, [(m) => m.f(.1), 'f(.1)']);
    tset(mock, [(m) => m.f(1.1), 'f(1.1)']);
    tset(mock, [(m) => m.f('1'), `f('1')`]);
    tset(mock, [(m) => m.f('1', '1'), `f('1', '1')`]);
    tset(mock, [(m) => m.f('1', '2'), `f('1', '2')`]);
    tset(mock, [(m) => m.f('2', '1'), `f('2', '1')`]);
    tset(mock, [(m) => m.f(undefined), 'f(undefined)']);
    tset(mock, [(m) => m.f(null), 'f(null)']);
    tset(mock, [(m) => m.f(''), `f('')`]);
    tset(mock, [(m) => m.f(true), 'f(true)']);
    tset(mock, [(m) => m.f(false), 'f(false)']);
    tset(mock, [(m) => m.f({}), 'f({})']);
    tset(mock, [(m) => m.f({ a: 1, b: 1 }), 'f({ a: 1, b: 1 })']);
    tset(mock, [(m) => m.f({ b: 1, a: 1 }), 'f({ b: 1, a: 1 })']);
    tset(mock, [(m) => m.f({ a: [1] }), 'f({ a: [1] })']);
    tset(mock, [(m) => m.f([]), 'f([])']);
    tset(mock, [(m) => m.f([1]), 'f([1])']);
    tset(mock, [(m) => m.f([1, undefined]), 'f([1, undefined])']);
    tset(mock, [(m) => m.f([undefined, 1]), 'f([undefined, 1])']);
    tset(mock, [(m) => m.f([{ a: 1 }]), 'f([{ a: 1 }])']);
    tset(mock, [(m) => m.f([{ a: 2 }]), 'f([{ a: 2 }])']);
    tset(mock, [(m) => m.f(() => 1), 'f(() => 1)']);
    tset(mock, [(m) => m.f(() => 2), 'f(() => 2)']);
    tset(mock, [(m) => m.f((a: any) => 1), 'f((a: any) => 1)']); // eslint-disable-line @typescript-eslint/no-unused-vars
    tset(mock, [(m) => m.f(NaN), 'f(NaN)']);
    tset(mock, [(m) => m.f(Infinity), 'f(Infinity)']);
    tset(mock, [(m) => m.f(-Infinity), 'f(-Infinity)']);
    tset(mock, [(m) => m.f(Symbol()), 'f(Symbol())']);
    tset(mock, [(m) => m.f(Symbol(1)), 'f(Symbol(1))']);

    // ASSERT
    expect(mock.f()).toBe('f()');
    expect(mock.f(1)).toBe('f(1)');
    expect(mock.f(0)).toBe('f(0)');
    expect(mock.f(-1)).toBe('f(-1)');
    expect(mock.f(.1)).toBe('f(.1)');
    expect(mock.f(1.1)).toBe('f(1.1)');
    expect(mock.f('1')).toBe(`f('1')`);
    expect(mock.f('1', '1')).toBe(`f('1', '1')`);
    expect(mock.f('1', '2')).toBe(`f('1', '2')`);
    expect(mock.f('2', '1')).toBe(`f('2', '1')`);
    expect(mock.f(undefined)).toBe('f(undefined)');
    expect(mock.f(null)).toBe('f(null)');
    expect(mock.f('')).toBe(`f('')`);
    expect(mock.f("")).toBe(`f('')`); // eslint-disable-line quotes
    expect(mock.f(``)).toBe(`f('')`);
    expect(mock.f(true)).toBe('f(true)');
    expect(mock.f(false)).toBe('f(false)');
    expect(mock.f({})).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f(Object.create({}))).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f(Object.create(null))).toBe('f({})'); // does not distinguish objects created with literal or constructor
    expect(mock.f({ a: 1, b: 1 })).toBe('f({ a: 1, b: 1 })');
    expect(mock.f({ b: 1, a: 1 })).toBe('f({ b: 1, a: 1 })');
    expect(mock.f({ a: [1] })).toBe('f({ a: [1] })');
    expect(mock.f([])).toBe('f([])');
    expect(mock.f([1])).toBe('f([1])');
    expect(mock.f([1, undefined])).toBe('f([1, undefined])');
    expect(mock.f([undefined, 1])).toBe('f([undefined, 1])');
    expect(mock.f([{ a: 1 }])).toBe('f([{ a: 1 }])');
    expect(mock.f([{ a: 2 }])).toBe('f([{ a: 2 }])');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expect(mock.f((a: any) => 1)).toBe('f((a: any) => 1)'); //Do not distinguish function args and bodies
    expect(mock.f(() => 1)).toBe('f((a: any) => 1)'); // does not distinguish function args and bodies
    expect(mock.f(() => 2)).toBe('f((a: any) => 1)'); // does not distinguish function args and bodies
    expect(mock.f(NaN)).toBe('f(NaN)');
    expect(mock.f(Infinity)).toBe('f(Infinity)');
    expect(mock.f(-Infinity)).toBe('f(-Infinity)');
    expect(mock.f(Symbol())).toBe('f(Symbol())');
    expect(mock.f(Symbol(1))).toBe('f(Symbol(1))');
  });
});

describe('------------------- treset --------------------', () => {
  test('reset of empty mock should not throw', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(() => treset(mock)).not.toThrow();
  })

  test('should erase mock return values', () => {
    // ARRANGE
    const mock = tm.mock([{ aaa: 7 }]);

    let res;

    mock.a.e = 7;
    mock.a.aa.aaa;
    mock.a.aa1.aaa;
    mock.a.aa.aaa1;
    mock.b;
    mock.c.c;

    res = tm.unmock(mock);
    expect(res).toEqual({
      aaa: 7,
      a: {
        aa: {
          aaa: 'mock.a.aa.aaa',
          aaa1: 'mock.a.aa.aaa1',
        },
        aa1: {
          aaa: 'mock.a.aa1.aaa',
        },
        e: 7,
      },
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock.a.aa);
    res = tm.unmock(mock);
    expect(res).toEqual({
      aaa: 7,
      a: {
        aa: 'value from mock.a.aa',
        aa1: {
          aaa: 'mock.a.aa1.aaa',
        },
        e: 7,
      },
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock.a);
    res = tm.unmock(mock);
    expect(res).toEqual({
      aaa: 7,
      a: 'value from mock.a',
      b: 'mock.b',
      c: {
        c: 'mock.c.c',
      },
    });

    tm.reset(mock);
    res = tm.unmock(mock);
    expect(res).toBe('value from mock'); // TODO: shouldn't it be { aaa: 7 } ?
  });

  test('should erase mock calls', () => {
    // ARRANGE
    treset();
    const mock1 = tmock([{ f: function fff() {} }], { defaultMockName: 'mock1', simplifiedOutputEnabled: false });
    const mock2 = tmock({ defaultMockName: 'mock2', simplifiedOutputEnabled: false });

    // ACT
    const mock3 = mock1.prop.f(Infinity);
    mock1.f();
    mock2.f();
    mock1.prop.f();
    mock2(function () {}, [1], {'0': 1});
    mock1.prop.f(Infinity).prop.f2([]);

    // ASSERT
    expect(tcalls()).toEqual([
      'mock1.prop.f(Infinity)',
      'mock1.f()',
      'mock2.f()',
      'mock1.prop.f()',
      'mock2(function, [1], {0: 1})',
      'mock1.prop.f(Infinity)',
      'mock1.prop.f(Infinity).prop.f2([])',
    ]);
    expect(tcalls(mock1)).toEqual([
      'mock1.prop.f(Infinity)',
      'mock1.f()',
      'mock1.prop.f()',
      'mock1.prop.f(Infinity)',
      'mock1.prop.f(Infinity).prop.f2([])',
    ]);
    expect(tcalls(mock2)).toEqual([
      'mock2.f()',
      'mock2(function, [1], {0: 1})',
    ]);

    // Reset mock1.prop.f(Infinity).
    treset(mock3);
    expect(tcalls()).toEqual([
      'mock1.f()',
      'mock2.f()',
      'mock1.prop.f()',
      'mock2(function, [1], {0: 1})',
    ]);
    expect(tcalls(mock1)).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tcalls(mock2)).toEqual([
      'mock2.f()',
      'mock2(function, [1], {0: 1})',
    ]);

    // Reset mock2.
    treset(mock2);
    expect(tcalls()).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tcalls(mock1)).toEqual([
      'mock1.f()',
      'mock1.prop.f()',
    ]);
    expect(tcalls(mock2)).toEqual([]);

    // Reset mock2.
    treset(mock1);
    expect(tcalls()).toEqual([]);
    expect(tcalls(mock1)).toEqual([]);
    expect(tcalls(mock2)).toEqual([]);
  });
});

describe('-------------------- tcalls -------------------', () => {
  test('should return only mock calls when mock argument is provided, otherwise all calls', () => {
    // ARRANGE
    treset();
    const mock1 = tmock('mock1', [{ f: function fff() {} }]);
    const mock2 = tmock('mock2', [{ f: function fff() {} }]);

    // ACT
    mock1.f();
    mock1.f(NaN);
    mock2.f();
    mock1.g();
    mock2();
    mock2.f1('1');
    mock2.f1(1).f2(2);
    mock2.f1(1).f2(2).f3(null, Symbol());

    // ASSERT
    expect(tcalls()).toEqual([
      'mock1.f()',
      'mock1.f(NaN)',
      'mock2.f()',
      'mock1.g()',
      'mock2()',
      'mock2.f1("1")',
      'mock2.f1(1)',
      'mock2.f1(1).f2(2)',
      'mock2.f1(1)',
      'mock2.f1(1).f2(2)',
      'mock2.f1(1).f2(2).f3(null, Symbol())',
    ]);
    expect(tcalls(mock1)).toEqual([
      'mock1.f()',
      'mock1.f(NaN)',
      'mock1.g()',
    ]);
    expect(tcalls(mock2)).toEqual([
      'mock2.f()',
      'mock2()',
      'mock2.f1("1")',
      'mock2.f1(1)',
      'mock2.f1(1).f2(2)',
      'mock2.f1(1)',
      'mock2.f1(1).f2(2)',
      'mock2.f1(1).f2(2).f3(null, Symbol())',
    ]);
  });

  test('should not wrap mocks into quotes', () => {
    // ARRANGE
    function f(arg1, arg2) {
      arg1(arg2.prop.p);
    }
    const mock1 = tmock('mock1', { simplifiedOutputEnabled: false });
    const mock2 = tmock('mock2', { simplifiedOutputEnabled: false });
    f(mock1, mock2);

    // ACT
    const res = tcalls(mock1);

    // ASSERT
    expect(res).toEqual(['mock1(mock2.prop.p)']);
  });

  test('should filter calls', () => {
    // ARRANGE
    function f(arg1) {
      arg1;
      arg1.a;
      arg1();
      arg1.a.f();
      arg1.fff();
      arg1.fff(arg1.fff(7));
    }
    const mock1 = tmock('mock1');
    f(mock1);

    // ASSERT
    expect(tcalls(mock1)).toEqual(['mock1()', 'mock1.a.f()', 'mock1.fff()', 'mock1.fff(7)', 'mock1.fff(mock1.fff(7))']);
    expect(tcalls(mock1.a)).toEqual(['mock1.a.f()']);
    expect(tcalls(mock1.a.f)).toEqual(['mock1.a.f()']);
    expect(tcalls(mock1.fff)).toEqual(['mock1.fff()', 'mock1.fff(7)', 'mock1.fff(mock1.fff(7))']);
  });
});

describe('----------------- tinfo ------------------', () => {
  test.each([...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE, jest.fn(() => DFAULT_NUMERIC_VALUE)])
    ('should setup externalMock property for functions if externalMock argument is provided %#', (initialStub) =>
  {
    // ACT
    const mock = tm.mock([{ f: initialStub }], { externalMock: jestMock });

    // ASSERT
    const res = tm.unmock(mock);
    expect(tinfo(res.f).externalMock).toBeDefined();
  });

  test.each([...FUNCTIONS_THAT_RETURN_DFAULT_NUMERIC_VALUE, jest.fn(() => DFAULT_NUMERIC_VALUE)])
    ('should not setup externalMock property for functions if externalMock argument is not provided %#', (initialStub) =>
  {
    // ACT
    const mock = tm.mock([{ f: initialStub }]);

    // ASSERT
    const res = tm.unmock(mock);
    expect(tinfo(res.f).externalMock).toBeUndefined();
  });
});

describe ('---------------- test with js -----------------', () => {
  test('hasOwnProperty should return true', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(mock.hasOwnProperty('a')).toBe(true);
  });

  test('implicit conversion should not crash', () => {
    // ARRANGE
    const mock = tmock();

    // ASSERT
    expect(() => mock > 1).not.toThrow();
  });

  test('use case: operators', () => {
    // ARRANGE
    const mock = tmock();
    const f = (a, b) => a > b;
    function f1(obj) {
      obj.aaa = 1;
      obj.bbb = f(obj.a, obj.a) ? 1 : obj.a * 2;
      return obj;
    }

    // ACT
    const res = tunmock(f1(mock));

    // ASSERT
    expect(res.aaa).toBe(1);
    expect(res.bbb).toBe(NaN);
  });
});
