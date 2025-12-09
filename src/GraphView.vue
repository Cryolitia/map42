<template>
  <div class="graph-wrapper">
    <div ref="container" id="container"></div>
    <div class="search-panel">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          @input="handleSearch"
          placeholder="Search ASN or Name..."
          class="search-input"
        />
        <button v-if="searchQuery" @click="clearSearch" class="clear-btn">✕</button>
      </div>
      <ul v-if="searchResults.length > 0" class="search-results">
        <li
          v-for="node in searchResults"
          :key="node.id"
          @click="selectFromSearch(node)"
          class="result-item"
        >
          <span class="result-asn">{{ node.asn }}</span>
          <span class="result-name">{{ node.name }}</span>
        </li>
      </ul>
    </div>
    <div ref="statsContainer" class="stats-panel"></div>
    <InfoCard
      :selectedNode="selectedNode"
      :config="config"
      @handleClose="handleClose"
      @focusSelect="focusSelect"
      @toggleHop2="toggleHop2"
      @toggleBg="toggleBg"
      @toggleText="toggleText"
      @toggleRotation="toggleRotation"
      @handleNodeClick="handleNodeClick"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, watch } from 'vue'
import type { PropType } from 'vue'

import InfoCard from './InfoCard.vue'

import ForceGraph3D from '3d-force-graph'
import type { ForceGraph3DInstance } from '3d-force-graph'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import Stats from 'stats.js'

import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js'
import type { GraphConfig, GraphLink, GraphNode, MapData, MapEdge, MapNode } from './types'
import { graphconfig, LDR_URLS } from './constants'

const props = defineProps({
  data: Object as PropType<MapData>,
})

const container = ref<HTMLElement | null>(null)
const statsContainer = ref<HTMLElement | null>(null)
const graphInstance = ref<ForceGraph3DInstance | null>(null)
const stats = ref<Stats | null>(null)

const selectedNode = ref<GraphNode | null>(null)

const highlightNodes = ref<Set<string>>(new Set())
const highlight2Nodes = ref<Set<string>>(new Set())

const searchQuery = ref('')
const searchResults = ref<GraphNode[]>([])
const allNodesCache = ref<GraphNode[]>([])

let modifiedLinks: GraphLink[] = []

const config: GraphConfig = reactive({
  showHop2: true,
  showBg: true,
  showText: true,
  isRotating: false,
})

const handleSearch = () => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query || query.length < 2) {
    searchResults.value = []
    return
  }
  searchResults.value = allNodesCache.value
    .filter((n) => n.asn.toLowerCase().includes(query) || n.name.toLowerCase().includes(query))
    .slice(0, 10)
}

const selectFromSearch = (node: GraphNode) => {
  handleNodeClick(node)
  focusSelect() // 自动居中
  clearSearch()
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = []
}

const processData = (rawNodes: MapNode[], rawEdges: MapEdge[]) => {
  const nodesMap = new Map<string, GraphNode>()

  const processedNodes: GraphNode[] = rawNodes.map((n) => {
    const val = (n.size || 1) * 40 - 60
    const node: GraphNode = {
      ...n,
      id: String(n.id),
      val: val > 0 ? val : 5,
      peers: new Set(),
      links: [],
    }
    nodesMap.set(node.id, node)
    return node
  })

  const processedEdges: GraphLink[] = rawEdges.map((e) => {
    const sId = String(e.sourceID)
    const tId = String(e.targetID)
    const sourceNode = nodesMap.get(sId)
    const targetNode = nodesMap.get(tId)

    const link: GraphLink = {
      source: sId,
      target: tId,
      _state: 0,
    }

    if (sourceNode && targetNode) {
      sourceNode.peers.add(targetNode)
      targetNode.peers.add(sourceNode)
      sourceNode.links.push(link)
      targetNode.links.push(link)
    }

    return link
  })

  allNodesCache.value = processedNodes
  return { nodes: processedNodes, links: processedEdges }
}

const updateSelected = (node: GraphNode | null) => {
  stopRotation()

  modifiedLinks.forEach((link) => {
    link._state = 0
  })
  modifiedLinks = []

  highlightNodes.value.clear()
  highlight2Nodes.value.clear()

  selectedNode.value = node

  if (node) {
    highlightNodes.value.add(node.id)

    node.links.forEach((link) => {
      link._state = 1
      modifiedLinks.push(link)

      const otherNodeId =
        (typeof link.source === 'object' ? (link.source as GraphNode).id : link.source) === node.id
          ? typeof link.target === 'object'
            ? (link.target as GraphNode).id
            : link.target
          : typeof link.source === 'object'
            ? (link.source as GraphNode).id
            : link.source

      if (typeof otherNodeId === 'string') highlightNodes.value.add(otherNodeId)
    })

    if (config.showHop2) {
      node.peers.forEach((peer) => {
        peer.links.forEach((link) => {
          if (link._state === 1) return

          if (link._state !== 2) {
            link._state = 2
            modifiedLinks.push(link)
          }

          const sId = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source
          const tId = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target

          if (!highlightNodes.value.has(sId as string)) highlight2Nodes.value.add(sId as string)
          if (!highlightNodes.value.has(tId as string)) highlight2Nodes.value.add(tId as string)
        })
      })
    }
  }

  refreshGraphVisuals()
}

const handleNodeClick = (node: GraphNode) => {
  if (!node) return
  if (selectedNode.value && selectedNode.value.id === node.id) return
  updateSelected(node)
}

const handleClose = () => {
  updateSelected(null)
  clearSearch()
}

const focusSelect = () => {
  if (!selectedNode.value || !graphInstance.value) return
  const node = selectedNode.value
  graphInstance.value.cameraPosition(
    { x: (node.x || 0) * 2, y: (node.y || 0) * 2, z: (node.z || 0) * 2 },
    { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
    3000,
  )
}

const refreshGraphVisuals = () => {
  const g = graphInstance.value
  if (!g) return

  g.nodeColor(g.nodeColor())
    .linkWidth(g.linkWidth())
    .linkColor(g.linkColor())
    .nodeThreeObject(g.nodeThreeObject())
}

const toggleHop2 = () => {
  config.showHop2 = !config.showHop2
  if (selectedNode.value) updateSelected(selectedNode.value)
}

const toggleBg = () => {
  config.showBg = !config.showBg
  if (!graphInstance.value) return
  const scene = graphInstance.value.scene()
  if (config.showBg) {
    new THREE.CubeTextureLoader().load(LDR_URLS, (bg) => (scene.background = bg))
  } else {
    scene.background = new THREE.Color(0x000000)
  }
}

const toggleText = () => {
  config.showText = !config.showText
  const g = graphInstance.value
  if (!g) return

  if (config.showText) {
    g.nodeLabel(null)
  } else {
    g.nodeLabel((n: GraphNode) => n.name)
  }
  g.nodeThreeObject(g.nodeThreeObject())
}

const toggleRotation = () => {
  if (!graphInstance.value || !selectedNode.value) return

  const controls = graphInstance.value.controls()

  config.isRotating = !config.isRotating

  if (config.isRotating) {
    const { x, y, z } = selectedNode.value
    controls.target.set(x || 0, y || 0, z || 0)
    controls.autoRotate = true
    controls.autoRotateSpeed = graphconfig.rotate.speed
  } else {
    controls.autoRotate = false
  }
}

const stopRotation = () => {
  if (config.isRotating && graphInstance.value) {
    config.isRotating = false
    const controls = graphInstance.value.controls()
    controls.autoRotate = false
  }
}

onMounted(() => {
  if (!props.data) return
  // 1. Stats
  if (statsContainer.value) {
    stats.value = new Stats()
    stats.value.showPanel(0)
    stats.value.dom.style.bottom = '0px'
    stats.value.dom.style.top = ''
    statsContainer.value.appendChild(stats.value.dom)
  }

  const g = ForceGraph3D({
    controlType: 'trackball',
    rendererConfig: { antialias: true, alpha: true },
  })(container.value!)

  graphInstance.value = g

  g.scene().fog = new THREE.FogExp2(0x000000, 0.0002)

  g.backgroundColor('#000000')
    .showNavInfo(false)
    .nodeRelSize(1)
    .nodeResolution(graphconfig.resolution.node)
    .linkResolution(graphconfig.resolution.edge)
    .nodeOpacity(graphconfig.opacity.node)
    .linkOpacity(graphconfig.opacity.edge)
    .nodeLabel(null)
    .onEngineTick(() => stats.value?.update())

  const { nodes, links } = processData(props.data.nodes, props.data.edges)
  g.graphData({ nodes, links })

  g.d3Force('link').distance(200)

  const controls = g.controls()

  controls.maxDistance = 4000

  controls.addEventListener('start', () => {
    if (config.isRotating) {
      stopRotation()
    }
  })

  g.nodeThreeObject((n: GraphNode) => {
    if (!config.showText) return null
    const group = new THREE.Object3D()
    const sprite = new SpriteText(n.name)
    sprite.material.depthWrite = false
    sprite.material.depthTest = false
    sprite.renderOrder = 999
    sprite.color = '#999999'
    sprite.textHeight = (n.size || 1) * 0.7
    sprite.strokeWidth = 1
    sprite.strokeColor = '#000000'
    sprite.position.z = n.size || 1
    group.add(sprite)
    return group
  })
  g.nodeThreeObjectExtend(true)

  g.nodeColor((n: GraphNode) => {
    const node = n as GraphNode
    if (selectedNode.value && node.id === selectedNode.value.id)
      return graphconfig.colors.node.selected(node.val)
    if (highlightNodes.value.has(node.id)) return graphconfig.colors.node.adj1(node.val)
    if (highlight2Nodes.value.has(node.id)) return graphconfig.colors.node.adj2(node.val)
    return graphconfig.colors.node.default(node, !!selectedNode.value)
  })

  g.linkColor((link: GraphLink) => {
    if (!selectedNode.value) return graphconfig.colors.edge.default
    switch (link._state) {
      case 1:
        return graphconfig.colors.edge.adj1
      case 2:
        return graphconfig.colors.edge.adj2
      default:
        return graphconfig.colors.edge.others
    }
  })

  g.linkWidth((link: GraphLink) => {
    if (!selectedNode.value) return graphconfig.size.link.default
    switch (link._state) {
      case 1:
        return graphconfig.size.link.adj1
      case 2:
        return graphconfig.size.link.adj2
      default:
        return graphconfig.size.link.others
    }
  })

  g.onNodeClick((node: GraphNode) => handleNodeClick(node))
    .onBackgroundClick(() => handleClose())
    .onLinkClick(() => handleClose())

  const composer = g.postProcessingComposer()

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    graphconfig.passes.bloom.strength,
    graphconfig.passes.bloom.radius,
    graphconfig.passes.bloom.threshold,
  )
  composer.addPass(bloomPass)

  const fxaaPass = new ShaderPass(FXAAShader)
  const pixelRatio = g.renderer().getPixelRatio()
  fxaaPass.material.uniforms['resolution'].value.x = 1 / (container.value!.offsetWidth * pixelRatio)
  fxaaPass.material.uniforms['resolution'].value.y =
    1 / (container.value!.offsetHeight * pixelRatio)
  composer.addPass(fxaaPass)

  if (config.showBg) {
    new THREE.CubeTextureLoader().load(
      LDR_URLS,
      (bg) => {
        if (g.scene()) g.scene().background = bg
      },
      undefined,
      () => {
        g.scene().background = new THREE.Color(0x000000)
      },
    )
  }
})

watch(
  () => props.data,
  (newData) => {
    if (graphInstance.value && newData) {
      handleClose()
      stopRotation()
      graphInstance.value.graphData(processData(newData.nodes, newData.edges))
    }
  },
  { deep: true },
)

onUnmounted(() => {
  graphInstance.value?._destructor()
})
</script>

<style scoped>
.graph-wrapper {
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: #000;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
}

#container {
  width: 100%;
  height: 100%;
}

.stats-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 5;
  pointer-events: none;
}

.search-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 30;
  width: 250px;
  font-family: 'Segoe UI', sans-serif;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: rgba(20, 20, 25, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 0 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.search-icon {
  margin-right: 8px;
  font-size: 14px;
  filter: grayscale(1);
}

.search-input {
  background: transparent;
  border: none;
  color: #fff;
  padding: 10px 0;
  width: 100%;
  outline: none;
  font-size: 14px;
}

.clear-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 16px;
}
.clear-btn:hover {
  color: #fff;
}

.search-results {
  list-style: none;
  margin: 5px 0 0 0;
  padding: 0;
  background: rgba(30, 30, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

.result-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  transition: background 0.2s;
}

.result-item:hover {
  background: rgba(0, 255, 255, 0.1);
}

.result-asn {
  font-size: 12px;
  color: #00bcd4; /* Cyan */
  font-family: monospace;
}

.result-name {
  font-size: 13px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
