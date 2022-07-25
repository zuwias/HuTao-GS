import Packet, { PacketInterface, PacketContext } from '#/packet'
import Logger from '@/logger'
import { ClientStateEnum } from '@/types/enum'
import { getNameByCmdId } from '#/cmdIds'
import { waitTick } from '@/utils/asyncWait'

const logger = new Logger('UNICMD', 0x80a0ff)

export interface UnionCmdNotify {
  cmdList: [
    UnionCmd: {
      messageId: number
      body: string
    }
  ]
}

class UnionCmdPacket extends Packet implements PacketInterface {
  constructor() {
    super('UnionCmd', {
      notifyState: ClientStateEnum.IN_GAME,
      notifyStatePass: true
    })
  }

  async recvNotify(context: PacketContext, data: UnionCmdNotify): Promise<void> {
    const { server, player, seqId } = context
    const { currentScene } = player
    const { entityManager } = currentScene
    const { cmdList } = data

    let i = 0
    for (let cmd of cmdList) {
      if (++i % 3 === 0) await waitTick()

      const { messageId, body } = cmd
      const packetName = getNameByCmdId(messageId).toString()

      logger.verbose(server.globalState.state.ShowPacketId ? messageId : '-', packetName)

      await server.packetHandler.handle(messageId, packetName, Buffer.from(body, 'base64'), context)
    }

    await player.forwardBuffer.sendAll()
    await entityManager.flushAll(seqId)
  }
}

let packet: UnionCmdPacket
export default (() => packet = packet || new UnionCmdPacket())()