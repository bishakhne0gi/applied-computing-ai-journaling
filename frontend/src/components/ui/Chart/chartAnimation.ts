export function chartAnimation(reduce: boolean) {
  return { isAnimationActive: !reduce, animationDuration: 300, animationEasing: 'ease-out' } as const
}
