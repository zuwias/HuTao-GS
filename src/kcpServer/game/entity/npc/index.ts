import Entity from '$/entity'
import { SceneNpcInfo } from '@/types/proto'
import { ProtEntityTypeEnum } from '@/types/proto/enum'

export default class Npc extends Entity {
  npcId: number

  parentQuestId: number
  roomId: number
  suitIdList: number[]

  constructor(npcId: number) {
    super()

    this.npcId = npcId

    this.config = { PropGrowCurves: [] }
    this.growCurve = []

    this.entityType = ProtEntityTypeEnum.PROT_ENTITY_NPC

    this.parentQuestId = 0
    this.roomId = 0
    this.suitIdList = []

    super.initHandlers(this)
  }

  exportSceneNpcInfo(): SceneNpcInfo {
    const { npcId, blockId, parentQuestId, roomId } = this

    const info: SceneNpcInfo = {
      npcId,
      blockId,
      parentQuestId,
      roomId
    }

    return info
  }
}