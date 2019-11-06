export const NO_DETAILER = d =>
  `You have passed a detailer type that may exist in PySyft, but is not currently supported in syft.js. Please file a feature request (https://github.com/OpenMined/syft.js/issues) for type ${
    d[0]
  }, with value: ${d[1]}.`;

export const NOT_ENOUGH_ARGS = (passed, expected) =>
  `You have passed ${passed} argument(s) when the plan requires ${expected} argument(s).`;

export const NO_PLAN = `The operation you're attempting to run requires a plan before being called.`;