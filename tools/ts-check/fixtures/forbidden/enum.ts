// Forbidden: an enum emits runtime code, so Node's type stripping cannot erase it.
enum Color {
  Red,
  Blue,
}
module.exports = { Color };
