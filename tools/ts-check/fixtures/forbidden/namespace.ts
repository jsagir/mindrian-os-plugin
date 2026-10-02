// Forbidden: a namespace with a value inside emits runtime code.
namespace Util {
  export const one = 1;
}
module.exports = { Util };
