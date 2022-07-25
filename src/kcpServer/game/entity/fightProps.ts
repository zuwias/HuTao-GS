import AvatarFightPropUpdate from '#/packets/AvatarFightPropUpdate'
import EntityFightPropChangeReason, { EntityFightPropChangeReasonNotify } from '#/packets/EntityFightPropChangeReason'
import EntityFightPropUpdate from '#/packets/EntityFightPropUpdate'
import Reliquary from '$/equip/reliquary'
import Weapon from '$/equip/weapon'
import { CurveArithEnum, FightPropEnum } from '@/types/enum'
import { EntityFightPropConfig } from '@/types/game'
import { CurveExcelConfig } from '@/types/gameData/ExcelBinOutput/CurveExcelConfig'
import { FightPropPair } from '@/types/proto'
import { ChangeEnergyReasonEnum, ChangeHpReasonEnum, PlayerDieTypeEnum, ProtEntityTypeEnum } from '@/types/proto/enum'
import PropsUserData from '@/types/user/PropsUserData'
import Entity from '.'
import Avatar from './avatar'
import Monster from './monster'

const DYNAMIC_PROPS = [
  FightPropEnum.FIGHT_PROP_HP,
  FightPropEnum.FIGHT_PROP_HP_PERCENT,
  FightPropEnum.FIGHT_PROP_ATTACK,
  FightPropEnum.FIGHT_PROP_ATTACK_PERCENT,
  FightPropEnum.FIGHT_PROP_DEFENSE,
  FightPropEnum.FIGHT_PROP_DEFENSE_PERCENT,
  FightPropEnum.FIGHT_PROP_CHARGE_EFFICIENCY,
  FightPropEnum.FIGHT_PROP_ELEMENT_MASTERY,
  FightPropEnum.FIGHT_PROP_FIRE_SUB_HURT,
  FightPropEnum.FIGHT_PROP_ELEC_SUB_HURT,
  FightPropEnum.FIGHT_PROP_ICE_SUB_HURT,
  FightPropEnum.FIGHT_PROP_WATER_SUB_HURT,
  FightPropEnum.FIGHT_PROP_WIND_SUB_HURT,
  FightPropEnum.FIGHT_PROP_ROCK_SUB_HURT,
  FightPropEnum.FIGHT_PROP_GRASS_SUB_HURT,
  FightPropEnum.FIGHT_PROP_CRITICAL,
  FightPropEnum.FIGHT_PROP_CRITICAL_HURT,
  FightPropEnum.FIGHT_PROP_HEAL_ADD,
  FightPropEnum.FIGHT_PROP_FIRE_ADD_HURT,
  FightPropEnum.FIGHT_PROP_ELEC_ADD_HURT,
  FightPropEnum.FIGHT_PROP_ICE_ADD_HURT,
  FightPropEnum.FIGHT_PROP_WATER_ADD_HURT,
  FightPropEnum.FIGHT_PROP_WIND_ADD_HURT,
  FightPropEnum.FIGHT_PROP_ROCK_ADD_HURT,
  FightPropEnum.FIGHT_PROP_GRASS_ADD_HURT,
  FightPropEnum.FIGHT_PROP_PHYSICAL_ADD_HURT,
  FightPropEnum.FIGHT_PROP_SHIELD_COST_MINUS_RATIO,
  FightPropEnum.FIGHT_PROP_HEALED_ADD,
  FightPropEnum.FIGHT_PROP_SKILL_CD_MINUS_RATIO,
  FightPropEnum.FIGHT_PROP_SPEED_PERCENT,
  FightPropEnum.FIGHT_PROP_PHYSICAL_SUB_HURT,
  FightPropEnum.FIGHT_PROP_ADD_HURT,
  FightPropEnum.FIGHT_PROP_SUB_HURT
]

export interface FightPropChangeReason {
  changeHpReason?: ChangeHpReasonEnum
  changeEnergyReason?: ChangeEnergyReasonEnum
}

export default class FightProp {
  entity: Entity

  propMap: { [id: number]: number }

  constructor(entity: Entity) {
    this.entity = entity

    this.propMap = {}
  }

  init(userData: PropsUserData) {
    for (let type in userData) {
      if (isNaN(parseInt(type))) continue
      this.set(parseInt(type), userData[type])
    }
  }

  async update(notify: boolean = false): Promise<void> {
    const curve = this.getCurve()
    if (!curve) return

    this.clear(true)

    if (this.entity.entityType === ProtEntityTypeEnum.PROT_ENTITY_WEAPON) {
      this.updateWeaponStats(curve)
      return
    }

    const hpPercent = this.get(FightPropEnum.FIGHT_PROP_MAX_HP) > 0 ? (this.get(FightPropEnum.FIGHT_PROP_CUR_HP) / this.get(FightPropEnum.FIGHT_PROP_MAX_HP)) : 1

    this.updateBaseStats(curve)

    const weaponList = this.getWeaponList()
    for (let weapon of weaponList) this.applyWeaponStats(weapon)

    const relicList = this.getRelicList()
    for (let relic of relicList) this.applyRelicStats(relic)

    this.updateHpStats()
    this.updateAtkStats()
    this.updateDefStats()

    this.set(FightPropEnum.FIGHT_PROP_CUR_HP, this.get(FightPropEnum.FIGHT_PROP_MAX_HP) * hpPercent)

    if (!notify) return
    await this.sendUpdateNotify(this.propMap)
  }

  private updateBaseStats(curve: CurveExcelConfig) {
    this.set(FightPropEnum.FIGHT_PROP_BASE_HP, this.calcBaseHp(curve))
    this.set(FightPropEnum.FIGHT_PROP_BASE_ATTACK, this.calcBaseAttack(curve))
    this.set(FightPropEnum.FIGHT_PROP_BASE_DEFENSE, this.calcBaseDefense(curve))

    if (this.entity.entityType !== ProtEntityTypeEnum.PROT_ENTITY_AVATAR) return

    const { Critical, CriticalHurt } = this.entity.config

    this.set(FightPropEnum.FIGHT_PROP_CRITICAL, Critical)
    this.set(FightPropEnum.FIGHT_PROP_CRITICAL_HURT, CriticalHurt)

    this.set(FightPropEnum.FIGHT_PROP_CHARGE_EFFICIENCY, 1)
    this.set(FightPropEnum.FIGHT_PROP_ELEMENT_MASTERY, 0)

    this.updateEnergyStats()
  }

  private updateHpStats() {
    const base = this.get(FightPropEnum.FIGHT_PROP_BASE_HP)
    const val = this.get(FightPropEnum.FIGHT_PROP_HP)
    const per = this.get(FightPropEnum.FIGHT_PROP_HP_PERCENT)

    this.set(FightPropEnum.FIGHT_PROP_MAX_HP, (base * (1 + per)) + val)
  }

  private updateAtkStats() {
    const base = this.get(FightPropEnum.FIGHT_PROP_BASE_ATTACK)
    const val = this.get(FightPropEnum.FIGHT_PROP_ATTACK)
    const per = this.get(FightPropEnum.FIGHT_PROP_ATTACK_PERCENT)

    this.set(FightPropEnum.FIGHT_PROP_CUR_ATTACK, (base * (1 + per)) + val)
  }

  private updateDefStats() {
    const base = this.get(FightPropEnum.FIGHT_PROP_BASE_DEFENSE)
    const val = this.get(FightPropEnum.FIGHT_PROP_DEFENSE)
    const per = this.get(FightPropEnum.FIGHT_PROP_DEFENSE_PERCENT)

    this.set(FightPropEnum.FIGHT_PROP_CUR_DEFENSE, (base * (1 + per)) + val)
  }

  private updateEnergyStats() {
    const costElemType = this.getCostElemType()
    const maxEnergy = this.getCostElemVal()
    const energyPercent = this.get(costElemType + 70) > 0 ? (this.getEnergy() / this.get(costElemType + 70)) : 1

    // Max energy
    this.set(costElemType + 70, maxEnergy)

    // Current energy
    this.set(costElemType + 1e3, maxEnergy * energyPercent)
  }

  private applyWeaponStats(weapon: Weapon) {
    const propList = weapon.entity.fightProps.exportPropList()
    for (let prop of propList) {
      const { propType, propValue } = prop
      this.add(propType, propValue)
    }
  }

  private applyRelicStats(reliquary: Reliquary) {
    this.applyRelicMainStats(reliquary)
    this.applyRelicSubStats(reliquary)
  }

  private applyRelicMainStats(reliquary: Reliquary) {
    const { mainPropType, mainPropValue } = reliquary
    if (mainPropType === FightPropEnum.FIGHT_PROP_NONE) return

    this.add(mainPropType, mainPropValue)
  }

  private applyRelicSubStats(reliquary: Reliquary) {
    const { subStatMap } = reliquary

    for (let key in subStatMap) {
      const type = parseInt(key)
      if (isNaN(type) || type === FightPropEnum.FIGHT_PROP_NONE) continue

      this.add(type, subStatMap[key])
    }
  }

  private applyCurve(base: number, curveArith: CurveArithEnum, value: number = 0) {
    switch (curveArith) {
      case CurveArithEnum.ARITH_ADD:
        return base + value
      case CurveArithEnum.ARITH_MULTI:
        return base * value
      default:
        return base
    }
  }

  private calcBaseAttack(curve: CurveExcelConfig) {
    const { AttackBase } = this.entity.config
    const curveType = this.getPropCurve(FightPropEnum.FIGHT_PROP_BASE_ATTACK)?.Type
    const curveInfo = curve.CurveInfos.find(i => i.Type === curveType)
    if (!curveInfo) return 0
    return this.applyCurve(AttackBase, CurveArithEnum[curveInfo.Arith], curveInfo.Value)
  }

  private calcBaseDefense(curve: CurveExcelConfig) {
    const { DefenseBase } = this.entity.config
    const curveType = this.getPropCurve(FightPropEnum.FIGHT_PROP_BASE_DEFENSE)?.Type
    const curveInfo = curve.CurveInfos.find(i => i.Type === curveType)
    if (!curveInfo) return 0
    return this.applyCurve(DefenseBase, CurveArithEnum[curveInfo.Arith], curveInfo.Value)
  }

  private calcBaseHp(curve: CurveExcelConfig) {
    const { HpBase } = this.entity.config
    const curveType = this.getPropCurve(FightPropEnum.FIGHT_PROP_BASE_HP)?.Type
    const curveInfo = curve.CurveInfos.find(i => i.Type === curveType)
    if (!curveInfo) return 0
    return this.applyCurve(HpBase, CurveArithEnum[curveInfo.Arith], curveInfo.Value)
  }

  private updateWeaponStats(curve: CurveExcelConfig) {
    for (let id in FightPropEnum) {
      const prop = parseInt(id)
      if (isNaN(prop)) continue

      const propCurve = this.getPropCurve(prop)
      const curveType = propCurve?.Type
      const curveInfo = curve.CurveInfos.find(i => i.Type === curveType)
      if (!curveInfo) continue

      this.set(prop, this.applyCurve(propCurve.Value, CurveArithEnum[curveInfo.Arith], curveInfo.Value))
    }
  }

  private getCurve() {
    const { entity } = this
    const { level, growCurve } = entity
    return growCurve.find(c => c.Level === level)
  }

  private getPropCurve(prop: FightPropEnum): { Type: string, Value?: number } {
    const { PropGrowCurves } = <EntityFightPropConfig>(this.entity.config || {})
    if (PropGrowCurves == null) return null

    const propCurve = PropGrowCurves.find(c => FightPropEnum[c.PropType] === prop)
    if (!propCurve) return null

    if (propCurve.Value == null) return { Type: propCurve.Type }
    else return { Type: propCurve.Type, Value: propCurve.Value }
  }

  private getWeaponList(): Weapon[] {
    const { entity } = this
    const { entityType } = entity

    switch (entityType) {
      case ProtEntityTypeEnum.PROT_ENTITY_AVATAR:
        return [(entity as Avatar).weapon].filter(weapon => weapon != null)
      case ProtEntityTypeEnum.PROT_ENTITY_MONSTER:
        return (entity as Monster).weaponList
      default:
        return []
    }
  }

  private getRelicList(): Reliquary[] {
    const { entity } = this
    const { entityType } = entity

    if (entityType !== ProtEntityTypeEnum.PROT_ENTITY_AVATAR) return []

    return <Reliquary[]>(<Avatar>entity).exportEquipList(true)
  }

  private getCostElemVal(): number {
    return (this.entity as Avatar).skillDepot?.getCostElemVal() || 0
  }

  private getCostElemType(): number {
    return (this.entity as Avatar).skillDepot?.getCostElemType() || 0
  }

  private getEnergy(): number {
    return this.get(this.getCostElemType() + 1e3)
  }

  async drainEnergy(notify: boolean = false, changeEnergyReason?: ChangeEnergyReasonEnum, seqId?: number): Promise<void> {
    if (this.entity.godMode) return

    const type = this.getCostElemType() + 1e3
    await this.set(type, 0, notify, { changeEnergyReason }, seqId)
  }

  async gainEnergy(val: number, notify: boolean = false, changeEnergyReason?: ChangeEnergyReasonEnum, seqId?: number): Promise<void> {
    const type = this.getCostElemType() + 1e3
    const gainAmount = Math.min(
      this.getCostElemVal() - this.get(type),
      Math.max(0, val)
    )
    await this.add(type, gainAmount, notify, { changeEnergyReason }, seqId)
  }

  async rechargeEnergy(notify: boolean = false, changeEnergyReason?: ChangeEnergyReasonEnum, seqId?: number): Promise<void> {
    const type = this.getCostElemType() + 1e3
    await this.set(type, this.getCostElemVal(), notify, { changeEnergyReason }, seqId)
  }

  async takeDamage(attackerId: number, val: number, notify: boolean = false, changeHpReason?: ChangeHpReasonEnum, seqId?: number): Promise<void> {
    if (this.entity.godMode) return

    const damage = Math.min(
      this.get(FightPropEnum.FIGHT_PROP_CUR_HP),
      Math.max(0, val)
    )

    if (damage <= 0) return

    this.add(FightPropEnum.FIGHT_PROP_CUR_HP, -damage, notify, { changeHpReason }, seqId)

    // Check if entity is dead
    if (this.get(FightPropEnum.FIGHT_PROP_CUR_HP) > 0) return
    let dieType: PlayerDieTypeEnum

    switch (changeHpReason) {
      case ChangeHpReasonEnum.CHANGE_HP_SUB_MONSTER:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_KILL_BY_MONSTER
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_GEAR:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_KILL_BY_GEAR
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_FALL:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_FALL
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_DRAWN:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_DRAWN
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_ABYSS:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_ABYSS
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_GM:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_GM
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_CLIMATE_COLD:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_CLIMATE_COLD
        break
      case ChangeHpReasonEnum.CHANGE_HP_SUB_STORM_LIGHTNING:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_STORM_LIGHTING
        break
      default:
        dieType = PlayerDieTypeEnum.PLAYER_DIE_NONE
    }

    await this.entity.kill(attackerId, dieType)
  }

  async heal(val: number, notify: boolean = false, changeHpReason?: ChangeHpReasonEnum, seqId?: number): Promise<void> {
    const healAmount = Math.min(
      this.get(FightPropEnum.FIGHT_PROP_MAX_HP) - this.get(FightPropEnum.FIGHT_PROP_CUR_HP)
      , Math.max(0, val)
    )
    this.add(FightPropEnum.FIGHT_PROP_CUR_HP, healAmount, notify, { changeHpReason }, seqId)
  }

  async fullHeal(notify: boolean = false, changeHpReason?: ChangeHpReasonEnum, seqId?: number): Promise<void> {
    this.set(FightPropEnum.FIGHT_PROP_CUR_HP, this.get(FightPropEnum.FIGHT_PROP_MAX_HP), notify, { changeHpReason }, seqId)
  }

  get(type: number) {
    return this.propMap[type] || 0
  }

  async set(type: number, val: number, notify: boolean = false, changeReason?: FightPropChangeReason, seqId?: number): Promise<void> {
    const oldVal = this.get(type)
    this.propMap[type] = val

    if (!notify) return
    await this.sendUpdateNotify({ [type]: val }, seqId)

    const { manager, entityId } = this.entity
    if (!manager || !changeReason) return

    const notifyData: EntityFightPropChangeReasonNotify = {
      entityId,
      propType: type,
      propDelta: val - oldVal,
      paramList: []
    }

    const { changeHpReason, changeEnergyReason } = changeReason
    if (changeHpReason != null) notifyData.changeHpReason = changeHpReason
    else if (changeEnergyReason != null) notifyData.changeEnergyReason = changeEnergyReason
    else return

    const broadcastContextList = manager.scene.broadcastContextList
    for (let ctx of broadcastContextList) ctx.seqId = seqId
    await EntityFightPropChangeReason.broadcastNotify(broadcastContextList, notifyData)
  }

  async add(type: number, val: number, notify: boolean = false, changeReason?: FightPropChangeReason, seqId?: number): Promise<void> {
    await this.set(type, this.get(type) + val, notify, changeReason, seqId)
  }

  clear(dynamic: boolean = false) {
    const { propMap } = this
    for (let type in propMap) {
      if (!dynamic || DYNAMIC_PROPS.includes(parseInt(type))) delete propMap[type]
    }
  }

  async sendUpdateNotify(fightPropMap: { [id: number]: number }, seqId?: number): Promise<void> {
    const { entity } = this
    const { manager, entityId, isOnScene } = entity

    if (manager && isOnScene) {
      const broadcastContextList = manager.scene.broadcastContextList
      for (let ctx of broadcastContextList) ctx.seqId = seqId
      await EntityFightPropUpdate.broadcastNotify(broadcastContextList, {
        entityId,
        fightPropMap
      })
    } else if (entity.entityType === ProtEntityTypeEnum.PROT_ENTITY_AVATAR) {
      await AvatarFightPropUpdate.sendNotify((entity as Avatar).player.context, {
        avatarGuid: (entity as Avatar).guid.toString(),
        fightPropMap
      })
    }
  }

  exportPropList(): FightPropPair[] {
    const { propMap } = this
    const list = []

    for (let type in propMap) {
      list.push({
        propType: type,
        propValue: propMap[type]
      })
    }

    return list
  }

  exportUserData(): PropsUserData {
    return Object.assign({}, this.propMap)
  }
}