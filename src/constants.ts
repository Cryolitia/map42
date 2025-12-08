const LDR_URLS = [
  '/static/skybox/right.png',
  '/static/skybox/left.png',
  '/static/skybox/top.png',
  '/static/skybox/bottom.png',
  '/static/skybox/front.png',
  '/static/skybox/back.png',
]

const graphconfig = {
  passes: {
    bloom: {
      strength: 1.2,
      radius: 1,
      threshold: 0.1,
    },
  },
  resolution: {
    node: 32,
    edge: 32,
  },
  opacity: {
    node: 1.0,
    edge: 0.3,
  },
  colors: {
    node: {
      default: (i: number) => `rgba(150,150,150,${i / 30})`,
      leaves: () => `rgba(100,100,100,0.5)`,
      selected: (i: number) => `rgba(100,255,255,${i / 10})`,
      adj1: (i: number) => `rgba(255,200,0,${i / 30})`,
      adj2: (i: number) => `rgba(255,30,0,${i / 20})`,
    },
    edge: {
      default: 'rgba(255,255,255,0.15)',
      adj1: 'rgba(0,255,255,0.4)',
      adj2: 'rgba(255,60,150,0.2)',
      others: 'rgba(255,255,255,0.1)',
    },
  },
  size: {
    link: {
      default: 0,
      adj1: 0.4,
      adj2: 0.3,
      others: 0.13,
    },
  },
  rotate: {
    speed: 2.0,
  },
}

export { LDR_URLS, graphconfig }
