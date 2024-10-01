export const nodeRadius = 50
export const miniNodeRadius = 10

export const miniNodeOffsets = {
  'top': {
    x: 0,
    y: -nodeRadius + miniNodeRadius / 2
  },
  'right': {
    x: nodeRadius - miniNodeRadius / 2,
    y: 0
  },
  'bottom': {
    x: 0,
    y: nodeRadius - miniNodeRadius / 2
  },
  'left': {
    x: -nodeRadius + miniNodeRadius / 2,
    y: 0
  },
}