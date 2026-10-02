// Forbidden: a constructor parameter property emits an assignment.
class Box {
  constructor(public size: number) {}
}
module.exports = { Box };
