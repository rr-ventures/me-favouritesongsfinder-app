import type { PipelineStep } from './types.js'

export interface DependencyNode {
  step: PipelineStep
  level: number
  dependsOn: string[]
  dependedOnBy: string[]
}

export class DependencyGraph {
  private nodes = new Map<string, DependencyNode>()

  register(steps: PipelineStep[]): void {
    this.nodes.clear()
    for (const step of steps) {
      this.nodes.set(step.name, {
        step,
        level: -1,
        dependsOn: step.dependsOn,
        dependedOnBy: [],
      })
    }

    // Build reverse edges
    for (const [name, node] of this.nodes) {
      for (const dep of node.dependsOn) {
        const depNode = this.nodes.get(dep)
        if (depNode) depNode.dependedOnBy.push(name)
      }
    }

    // Compute levels via topological BFS
    const inDegree = new Map<string, number>()
    for (const [name, node] of this.nodes) {
      inDegree.set(name, node.dependsOn.length)
    }

    const queue: string[] = []
    for (const [name, deg] of inDegree) {
      if (deg === 0) queue.push(name)
    }

    while (queue.length > 0) {
      const name = queue.shift()!
      const node = this.nodes.get(name)!

      // Level = max(dep levels) + 1
      let maxDepLevel = -1
      for (const dep of node.dependsOn) {
        const depNode = this.nodes.get(dep)
        if (depNode) maxDepLevel = Math.max(maxDepLevel, depNode.level)
      }
      node.level = maxDepLevel + 1

      for (const dependent of node.dependedOnBy) {
        const deg = (inDegree.get(dependent) ?? 1) - 1
        inDegree.set(dependent, deg)
        if (deg === 0) queue.push(dependent)
      }
    }
  }

  getExecutionOrder(stepNames?: string[]): string[][] {
    const names = stepNames ?? [...this.nodes.keys()]
    const included = new Set(names)

    const maxLevel = Math.max(...[...this.nodes.values()].map((n) => n.level))
    const levels: string[][] = []

    for (let l = 0; l <= maxLevel; l++) {
      const atLevel = [...this.nodes.entries()]
        .filter(([name, node]) => node.level === l && included.has(name))
        .map(([name]) => name)
      if (atLevel.length > 0) levels.push(atLevel)
    }

    return levels
  }

  getMissingDependencies(stepName: string): string[] {
    const node = this.nodes.get(stepName)
    if (!node) return []
    return node.dependsOn.filter((dep) => !this.nodes.has(dep))
  }

  getNode(stepName: string): DependencyNode | undefined {
    return this.nodes.get(stepName)
  }

  getAllNodes(): DependencyNode[] {
    return [...this.nodes.values()].sort((a, b) => a.level - b.level || a.step.displayName.localeCompare(b.step.displayName))
  }

  getPrerequisites(stepName: string): string[] {
    const node = this.nodes.get(stepName)
    if (!node) return []
    const deps = new Set<string>()
    const visit = (name: string) => {
      const n = this.nodes.get(name)
      if (!n) return
      for (const dep of n.dependsOn) {
        if (!deps.has(dep)) {
          deps.add(dep)
          visit(dep)
        }
      }
    }
    visit(stepName)
    return [...deps]
  }
}
