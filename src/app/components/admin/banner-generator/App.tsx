import '@fontsource/manrope/500.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import 'flag-icons/css/flag-icons.min.css'
import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from 'd3-geo'
import { toPng } from 'html-to-image'
import countries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import './App.css'
import airportsData from 'airports-data/airports.json'
import worldLandAtlas from 'world-atlas/land-110m.json'
import defaultBackgroundAsset from './assets/saint-petersburg-default.jpg'
import tourMapLakesJson from './assets/tour-map-lakes.json'
import tourMapMountainRangesJson from './assets/tour-map-mountains.json'
import tourMapRiversJson from './assets/tour-map-rivers.json'
import tourMapSatelliteReliefAsset from './assets/tour-map-satellite-relief.webp'
import tourMapSteppeJson from './assets/tour-map-steppe.json'
import vatsimBoundariesGeoJson from './assets/vatsim-boundaries.json'
import simawareRegionalBoundariesJson from './assets/simaware-regional-boundaries.json'
import ragAircraftCatalog from './data/rag-aircraft.json'
import vnwsAircraftCatalog from './data/vnws-aircraft.json'
import ragLogoAsset from './assets/rag-logo.png.png'
import enLocale from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(enLocale)

type Locale = 'ru' | 'en'
type AppMode = 'banner' | 'badge'
type BadgeShape = 'circle' | 'rounded-square' | 'shield'
type BadgeFrame = 'ring' | 'hex' | 'ticket'
type BadgeLayerStyle = 'orbital' | 'winged' | 'crest'
type BadgePaletteMode = 'brand' | 'custom'
type BadgeIcon =
  | 'star'
  | 'aircraft'
  | 'jet'
  | 'airliner'
  | 'prop'
  | 'helicopter'
  | 'route'
  | 'globe'
  | 'medal'
  | 'crown'
  | 'vatsim'
  | 'laurel'

const brandSourceMap = {
  nordwind: 'vnws',
  rag: 'rag',
} as const

type EventType =
  | 'event'
  | 'vatsim-region'
  | 'focus-airport'
  | 'tour'
  | 'roster'
  | 'curated-roster'
  | 'community-challenge'
  | 'community-goal'

type RouteEventType = 'tour' | 'roster' | 'curated-roster'

type CommunityEventType = 'community-challenge' | 'community-goal'

type ChallengeCountType = 'passengers' | 'freight' | 'flights' | 'distance' | 'flight-time'

type BrandKey = 'nordwind' | 'rag'

type AircraftSource = 'vnws' | 'rag'

type BonusField =
  | 'focusBonusPoints'
  | 'vatsimRegionBonusPoints'
  | 'tourBonusPoints'
  | 'rosterBonusPoints'
  | 'curatedRosterBonusPoints'
  | 'challengeBonusPoints'
  | 'communityGoalBonusPoints'

type RegistrationField =
  | 'focusRegistrationRequired'
  | 'vatsimRegionRegistrationRequired'
  | 'tourRegistrationRequired'
  | 'rosterRegistrationRequired'
  | 'curatedRosterRegistrationRequired'
  | 'challengeRegistrationRequired'
  | 'communityGoalRegistrationRequired'

type AircraftEnabledField = 'rosterAircraftEnabled' | 'curatedRosterAircraftEnabled'

type AircraftSearchField = 'rosterAircraftSearch' | 'curatedRosterAircraftSearch'

type AircraftSourceField = 'rosterAircraftSource' | 'curatedRosterAircraftSource'

type AircraftIdField = 'rosterAircraftId' | 'curatedRosterAircraftId'

type AircraftNameField = 'rosterAircraftName' | 'curatedRosterAircraftName'

type AircraftRegistrationField = 'rosterAircraftRegistration' | 'curatedRosterAircraftRegistration'

type AircraftPhotoUrlField = 'rosterAircraftPhotoUrl' | 'curatedRosterAircraftPhotoUrl'

type AircraftPhotoAttributionField = 'rosterAircraftPhotoAttribution' | 'curatedRosterAircraftPhotoAttribution'

type AircraftPhotoLinkbackField = 'rosterAircraftPhotoLinkback' | 'curatedRosterAircraftPhotoLinkback'

type AircraftPhotoManualField = 'rosterAircraftPhotoManual' | 'curatedRosterAircraftPhotoManual'

type AircraftPhotoOffsetXField = 'rosterAircraftPhotoOffsetX' | 'curatedRosterAircraftPhotoOffsetX'

type AircraftPhotoOffsetYField = 'rosterAircraftPhotoOffsetY' | 'curatedRosterAircraftPhotoOffsetY'

type AircraftPhotoZoomField = 'rosterAircraftPhotoZoom' | 'curatedRosterAircraftPhotoZoom'

type RouteAircraftVisualMode = 'map' | 'aircraft'
type MapThemeMode = 'classic' | 'steel' | 'aurora'
type MapDetailMode = 'fir' | 'fir-tma'

type BannerFormState = {
  city: string
  countryCode: string
  icao: string
  airportName: string
  rewardPrefixText: string
  rewardSuffixText: string
  mapZoom: string
  mapOffsetX: string
  mapOffsetY: string
  mapTheme: MapThemeMode
  mapDetailMode: MapDetailMode
  rosterVisualMode: RouteAircraftVisualMode
  curatedRosterVisualMode: RouteAircraftVisualMode
  vatsimEvent: boolean
  complexEventTitle: string
  complexEventDescription: string
  complexEventVnwsLegs: string
  complexEventRagLegs: string
  complexEventVnwsBonusPoints: string
  complexEventRagBonusPoints: string
  complexEventVnwsRegistrationRequired: boolean
  complexEventRagRegistrationRequired: boolean
  vatsimRegionTitle: string
  vatsimRegionDescription: string
  vatsimRegionHosts: string
  vatsimRegionPartners: string
  vatsimRegionDivisionSelection: string
  vatsimRegionPresetSelection: string
  vatsimRegionFirSelection: string
  vatsimRegionVnwsLegs: string
  vatsimRegionRagLegs: string
  vatsimRegionBonusPoints: string
  vatsimRegionRegistrationRequired: boolean
  focusBonusPoints: string
  focusRegistrationRequired: boolean
  tourTitle: string
  tourLegs: string
  tourDescription: string
  tourBonusPoints: string
  tourRegistrationRequired: boolean
  rosterTitle: string
  rosterLegs: string
  rosterDescription: string
  rosterBonusPoints: string
  rosterRegistrationRequired: boolean
  rosterAircraftEnabled: boolean
  rosterAircraftSearch: string
  rosterAircraftSource: string
  rosterAircraftId: string
  rosterAircraftName: string
  rosterAircraftRegistration: string
  rosterAircraftPhotoUrl: string
  rosterAircraftPhotoAttribution: string
  rosterAircraftPhotoLinkback: string
  rosterAircraftPhotoManual: boolean
  rosterAircraftPhotoOffsetX: string
  rosterAircraftPhotoOffsetY: string
  rosterAircraftPhotoZoom: string
  curatedRosterTitle: string
  curatedRosterLegs: string
  curatedRosterDescription: string
  curatedRosterBonusPoints: string
  curatedRosterRegistrationRequired: boolean
  curatedRosterAircraftEnabled: boolean
  curatedRosterAircraftSearch: string
  curatedRosterAircraftSource: string
  curatedRosterAircraftId: string
  curatedRosterAircraftName: string
  curatedRosterAircraftRegistration: string
  curatedRosterAircraftPhotoUrl: string
  curatedRosterAircraftPhotoAttribution: string
  curatedRosterAircraftPhotoLinkback: string
  curatedRosterAircraftPhotoManual: boolean
  curatedRosterAircraftPhotoOffsetX: string
  curatedRosterAircraftPhotoOffsetY: string
  curatedRosterAircraftPhotoZoom: string
  challengeName: string
  challengeBonusPoints: string
  challengeRegistrationRequired: boolean
  communityGoalName: string
  communityGoalDescription: string
  communityGoalCountType: ChallengeCountType
  communityGoalTargetAmount: string
  communityGoalBonusPoints: string
  communityGoalRegistrationRequired: boolean
}

type BadgeFormState = {
  title: string
  subtitle: string
  topLabel: string
  shape: BadgeShape
  frame: BadgeFrame
  layerStyle: BadgeLayerStyle
  paletteMode: BadgePaletteMode
  icon: BadgeIcon
  backgroundColor: string
  accentColor: string
  textColor: string
}

type CommunityTeam = {
  id: number
  name: string
  countType: ChallengeCountType
  targetAmount: string
}

type InterfaceCopy = {
  appTitle: string
  appDescription: string
  projectLabel: string
  backgroundSuggestionsLabel: string
  backgroundRandomizeButton: string
  backgroundRegenerateButton: string
  backgroundSaveFavoriteButton: string
  backgroundFavoritesLabel: string
  backgroundFavoritesEmptyLabel: string
  backgroundRemoveFavoriteButton: string
  backgroundFavoriteLoadError: string
  eventTypeLabel: string
  complexEventEventName: string
  vatsimRegionEventName: string
  focusAirportEventName: string
  tourEventName: string
  rosterEventName: string
  curatedRosterEventName: string
  communityChallengeEventName: string
  communityGoalEventName: string
  interfaceLanguageLabel: string
  bannerSettingsTitle: string
  cityLabel: string
  countryCodeLabel: string
  icaoLabel: string
  bonusPointsLabel: string
  airportNameLabel: string
  complexEventTitleLabel: string
  complexEventTitlePlaceholder: string
  complexEventDescriptionLabel: string
  complexEventDescriptionHelp: string
  complexEventDescriptionPlaceholder: string
  complexEventVnwsLegsLabel: string
  complexEventRagLegsLabel: string
  complexEventLegsHelp: string
  complexEventVnwsBonusLabel: string
  complexEventRagBonusLabel: string
  complexEventProjectsLabel: string
  vatsimRegionTitleLabel: string
  vatsimRegionTitlePlaceholder: string
  vatsimRegionDescriptionLabel: string
  vatsimRegionDescriptionHelp: string
  vatsimRegionDescriptionPlaceholder: string
  vatsimRegionHostsLabel: string
  vatsimRegionHostsPlaceholder: string
  vatsimRegionPartnersLabel: string
  vatsimRegionPartnersPlaceholder: string
  vatsimRegionRegionsTitle: string
  vatsimRegionProjectsTitle: string
  vatsimRegionBonusLabel: string
  vatsimRegionVnwsLegsLabel: string
  vatsimRegionRagLegsLabel: string
  vatsimRegionLegsHelp: string
  tourTitleLabel: string
  tourTitlePlaceholder: string
  tourLegsLabel: string
  tourStopsLabel: string
  tourLegsHelp: string
  tourLegsPlaceholder: string
  tourDescriptionLabel: string
  tourDescriptionHelp: string
  tourDescriptionPlaceholder: string
  tourPreviewIntro: string
  rosterTitleLabel: string
  rosterTitlePlaceholder: string
  rosterDescriptionLabel: string
  rosterDescriptionHelp: string
  rosterDescriptionPlaceholder: string
  curatedRosterTitleLabel: string
  curatedRosterTitlePlaceholder: string
  curatedRosterDescriptionLabel: string
  curatedRosterDescriptionHelp: string
  curatedRosterDescriptionPlaceholder: string
  aircraftAssignmentLabel: string
  aircraftAssignmentHelp: string
  aircraftSearchLabel: string
  aircraftSearchPlaceholder: string
  aircraftSearchHelp: string
  aircraftListLabel: string
  aircraftAirlineFilterLabel: string
  aircraftAirlineFilterAllLabel: string
  aircraftListEmpty: string
  aircraftNameLabel: string
  aircraftRegistrationLabel: string
  aircraftPhotoLabel: string
  aircraftPhotoHelp: string
  aircraftPhotoLoading: string
  aircraftPhotoEmpty: string
  aircraftPhotoAttributionPrefix: string
  aircraftPhotoAdjustLabel: string
  aircraftPhotoAdjustHelp: string
  aircraftPhotoAdjustManualLabel: string
  aircraftPhotoOffsetXLabel: string
  aircraftPhotoOffsetYLabel: string
  aircraftPhotoZoomLabel: string
  aircraftPhotoToggleMore: string
  aircraftPhotoToggleLess: string
  previewPhotoToolsLabel: string
  previewPhotoToolsHint: string
  previewPhotoToolsOpenLabel: string
  previewPhotoDragHint: string
  previewPhotoResetButton: string
  previewMapToolsLabel: string
  previewMapToolsHint: string
  previewMapToolsOpenLabel: string
  previewMapZoomLabel: string
  previewMapOffsetXLabel: string
  previewMapOffsetYLabel: string
  previewMapResetButton: string
  previewMapPanHint: string
  previewMapDetailLabel: string
  previewMapDetailFirLabel: string
  previewMapDetailFirTmaLabel: string
  previewMapThemeLabel: string
  previewMapThemeClassicLabel: string
  previewMapThemeSteelLabel: string
  previewMapThemeAuroraLabel: string
  curatedRosterVisualLabel: string
  curatedRosterVisualMapLabel: string
  curatedRosterVisualAircraftLabel: string
  complexEventVisualLabel: string
  complexEventVisualHelp: string
  complexEventVisualDisplay: string
  vatsimRegionVisualLabel: string
  vatsimRegionVisualHelp: string
  vatsimRegionVisualDisplay: string
  tourVisualLabel: string
  tourVisualHelp: string
  tourAutoVisualDisplay: string
  challengeNameLabel: string
  challengeNamePlaceholder: string
  communityTeamsTitle: string
  communityTeamsHelp: string
  communityTeamLabel: string
  communityTeamFallbackName: string
  communityTeamNameLabel: string
  communityTeamCountTypeLabel: string
  communityTeamTargetLabel: string
  communityAddTeamButton: string
  communityRemoveTeamButton: string
  communityGoalNameLabel: string
  communityGoalNamePlaceholder: string
  communityGoalDescriptionLabel: string
  communityGoalDescriptionHelp: string
  communityGoalDescriptionPlaceholder: string
  communityGoalCountTypeLabel: string
  communityGoalTargetLabel: string
  communityGoalHelp: string
  communityVisualLabel: string
  communityVisualHelp: string
  communityAutoVisualDisplay: string
  imagesTitle: string
  cityPhotoLabel: string
  cityPhotoHelp: string
  choosePhotoButton: string
  defaultBackgroundDisplay: string
  restoreDefaultBackgroundButton: string
  autoBackgroundLoadingLabel: string
  autoBackgroundDisplayPrefix: string
  autoBackgroundEmptyLabel: string
  autoBackgroundErrorLabel: string
  logoLabel: string
  logoHelp: string
  defaultLogoDisplayPrefix: string
  exportTitle: string
  exportHelp: string
  exportPngButton: string
  exportingButton: string
  previewLabel: string
  previewTitle: string
  resolutionChip: string
  rewardLabel: string
  rewardPrefix: string
  rewardSuffix: string
  rewardTextLabel: string
  rewardTextPrefixLabel: string
  rewardTextSuffixLabel: string
  rewardTextHelp: string
  vatsimEventLabel: string
  vatsimEventHelp: string
  vatsimEventBadge: string
  registrationRequiredLabel: string
  registrationRequiredHelp: string
  registrationRequiredBadge: string
  tourPreviewLabel: string
  tourPreviewEmpty: string
  rosterPreviewLabel: string
  rosterPreviewEmpty: string
  curatedRosterPreviewLabel: string
  curatedRosterPreviewEmpty: string
  communityPreviewLabel: string
  communityPreviewIntro: string
  communityPreviewEmpty: string
  communityGoalPreviewLabel: string
  communityGoalPreviewIntro: string
  complexEventPreviewLabel: string
  complexEventPreviewEmpty: string
  vatsimRegionPreviewLabel: string
  vatsimRegionPreviewEmpty: string
  logoAriaLabel: string
  logoOverlayLabel: string
  logoOverlayHelp: string
  exportError: string
}

const defaultTourDescription: Record<Locale, string> = {
  ru: 'Маршрут размещается на векторной карте мира по координатам аэропортов из введённых легов.',
  en: 'The route is placed on a vector world map using the airport coordinates from the legs you enter.',
}

const defaultVatsimRegionDescription: Record<Locale, string> = {
  ru: 'Совместный VATSIM-ивент с упором на региональное партнёрство, ATC coverage и синхронные маршруты vNWS и RAG.',
  en: 'A joint VATSIM event focused on regional partnerships, ATC coverage, and synchronized vNWS and RAG routes.',
}

const defaultRosterDescription: Record<Locale, string> = {
  ru: 'Roster-ивент использует опубликованную последовательность легов. Участнику нужно выполнить маршрут в указанном порядке.',
  en: 'A roster event uses a published sequence of legs. Participants complete the route in the listed order.',
}

const defaultCuratedRosterDescription: Record<Locale, string> = {
  ru: 'Curated roster оформляет персональный план смены: маршрут, логика перелётов и короткий briefing по выполнению.',
  en: 'A curated roster acts like a personal shift plan: route sequence, flow, and a short briefing for how to fly it.',
}

const defaultCommunityGoalDescription: Record<Locale, string> = {
  ru: 'Р’СЃСЏ РєРѕРјСЊСЋРЅРёС‚Рё Р»РµС‚Р°РµС‚ РІ РѕРґРёРЅ РѕР±С‰РёР№ СЃС‡С‘С‚С‡РёРє РґРѕ РґРѕСЃС‚РёР¶РµРЅРёСЏ С†РµР»Рё.',
  en: 'The whole community flies toward one shared counter until the goal is reached.',
}

const defaultComplexEventDescription: Record<Locale, string> = {
  ru: 'Общий ивент для vNWS и RAG: одна карта, два проекта и отдельные цветные леги для каждого направления.',
  en: 'A shared event for vNWS and RAG: one map, two projects, and separate colored legs for each route set.',
}

const aircraftAirlineCodeLabels: Record<string, string> = {
  AFL: 'Aeroflot',
  AUL: 'Smartavia',
  ER: 'IKAR',
  NWS: 'Nordwind Airlines',
  PBD: 'Pobeda',
  SBI: 'S7 Airlines',
  STW: 'Southwind',
  SVR: 'Ural Airlines',
  UTA: 'UTair',
  VKO: 'VKO Airlines',
}

const autoSyncAircraftCatalog = false

const bannerSettingsStorageKey = 'banner-generator-settings-v2'

type StoredBannerSettings = {
  appMode?: AppMode
  form?: Partial<BannerFormState>
  badgeForm?: Partial<BadgeFormState>
  communityTeams?: CommunityTeam[]
}

type RouteEventFormConfig = {
  titleField: 'tourTitle' | 'rosterTitle' | 'curatedRosterTitle'
  legsField: 'tourLegs' | 'rosterLegs' | 'curatedRosterLegs'
  descriptionField: 'tourDescription' | 'rosterDescription' | 'curatedRosterDescription'
  bonusField: 'tourBonusPoints' | 'rosterBonusPoints' | 'curatedRosterBonusPoints'
  registrationField: 'tourRegistrationRequired' | 'rosterRegistrationRequired' | 'curatedRosterRegistrationRequired'
  titleLabel: string
  titlePlaceholder: string
  descriptionLabel: string
  descriptionHelp: string
  descriptionPlaceholder: string
  previewLabel: string
  previewEmpty: string
}

type AircraftFieldConfig = {
  enabledField: AircraftEnabledField
  searchField: AircraftSearchField
  sourceField: AircraftSourceField
  idField: AircraftIdField
  nameField: AircraftNameField
  registrationField: AircraftRegistrationField
  photoUrlField: AircraftPhotoUrlField
  photoAttributionField: AircraftPhotoAttributionField
  photoLinkbackField: AircraftPhotoLinkbackField
  photoManualField: AircraftPhotoManualField
  photoOffsetXField: AircraftPhotoOffsetXField
  photoOffsetYField: AircraftPhotoOffsetYField
  photoZoomField: AircraftPhotoZoomField
}

type AircraftCatalogItem = {
  source: string
  aircraft_id: number | null
  fleet_id: number | null
  registration: string
  name: string
  fleet_name: string | null
  fleet_code: string | null
  fleet_type: string | null
  image_url: string | null
  image_attribution: string | null
  image_linkback: string | null
  passengers: number | null
  cargo: number | null
  is_hidden: boolean
  tags: string[]
}

type AircraftPhotoOption = {
  provider: string
  image_url: string
  thumbnail_url: string | null
  attribution: string | null
  linkback: string | null
}

const bundledAircraftCatalogBySource: Record<AircraftSource, AircraftCatalogItem[]> = {
  rag: ragAircraftCatalog as AircraftCatalogItem[],
  vnws: vnwsAircraftCatalog as AircraftCatalogItem[],
}

type CreationGalleryItem = {
  id: string
  event_type: string
  brand: string
  title: string
  description: string | null
  image_url: string | null
  created_at: string
}

type GuideCopy = {
  title: string
  close: string
  intro: string
  complexEvent: string
  vatsimRegion: string
  focusAirport: string
  tour: string
  roster: string
  curatedRoster: string
  communityChallenge: string
  communityGoal: string
  archiveTitle: string
  archiveEmpty: string
  archiveLoadError: string
}

function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return '/api'
  }

  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  return '/api'
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'ru'
  }

  return window.localStorage.getItem('banner-generator-locale') === 'en' ? 'en' : 'ru'
}

function inferPrefillEventType(category: string, type: string, tag: string, target: string): EventType {
  const haystack = [category, type, tag, target].join(' ').trim().toLowerCase()

  if (haystack.includes('community')) {
    return 'community-challenge'
  }

  if (haystack.includes('roster')) {
    return haystack.includes('curated') ? 'curated-roster' : 'roster'
  }

  if (haystack.includes('tour')) {
    return 'tour'
  }

  if (haystack.includes('vatsim')) {
    return 'vatsim-region'
  }

  return 'event'
}

function parseIcaoCandidate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const match = String(value ?? '').toUpperCase().match(/\b[A-Z]{4}\b/)

    if (match) {
      return match[0]
    }
  }

  return ''
}

function SettingsAccordionSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="settings-accordion" open={defaultOpen}>
      <summary className="settings-accordion-summary">
        <span className="settings-accordion-title">{title}</span>
        <span className="settings-accordion-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="M5.25 7.5 10 12.25 14.75 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>

      <div className="settings-accordion-content">{children}</div>
    </details>
  )
}

function createDefaultFormState(locale: Locale): BannerFormState {
  return {
    city: 'Saint Petersburg',
    countryCode: 'RU',
    icao: 'ULLI',
    airportName: 'Pulkovo',
    rewardPrefixText: locale === 'ru' ? 'Получите дополнительно' : 'Earn additional',
    rewardSuffixText: locale === 'ru' ? 'бонусных баллов' : 'bonus points',
    mapZoom: '100',
    mapOffsetX: '0',
    mapOffsetY: '0',
    mapTheme: 'classic',
    mapDetailMode: 'fir',
    rosterVisualMode: 'aircraft',
    curatedRosterVisualMode: 'aircraft',
    vatsimEvent: false,
    complexEventTitle: 'Northern Bridge Joint Event',
    complexEventDescription: defaultComplexEventDescription[locale],
    complexEventVnwsLegs: 'ULLI - UUEE\nUUEE - URSS',
    complexEventRagLegs: 'UUDD - ULLI\nULLI - UUDD',
    complexEventVnwsBonusPoints: '350',
    complexEventRagBonusPoints: '350',
    complexEventVnwsRegistrationRequired: false,
    complexEventRagRegistrationRequired: false,
    vatsimRegionTitle: 'Cross-Region VATSIM Operations',
    vatsimRegionDescription: defaultVatsimRegionDescription[locale],
    vatsimRegionHosts: '',
    vatsimRegionPartners: 'VATRUS, VATEUD',
    vatsimRegionDivisionSelection: defaultVatsimRegionDivisionSelection,
    vatsimRegionPresetSelection: '',
    vatsimRegionFirSelection: '',
    vatsimRegionVnwsLegs: 'ULLI - EDDM\nEDDM - LOWW',
    vatsimRegionRagLegs: 'UUEE - LKPR\nLKPR - UUDD',
    vatsimRegionBonusPoints: '500',
    vatsimRegionRegistrationRequired: true,
    focusBonusPoints: '350',
    focusRegistrationRequired: false,
    tourTitle: 'Northern Cross Tour',
    tourLegs: 'ULLI - UUEE\nUUEE - URSS\nURSS - ULLI',
    tourDescription: defaultTourDescription[locale],
    tourBonusPoints: '350',
    tourRegistrationRequired: false,
    rosterTitle: 'April Route Roster',
    rosterLegs: 'UUEE - ULLI\nULLI - UUEE\nUUEE - URSS',
    rosterDescription: defaultRosterDescription[locale],
    rosterBonusPoints: '350',
    rosterRegistrationRequired: false,
    rosterAircraftEnabled: false,
    rosterAircraftSearch: '',
    rosterAircraftSource: '',
    rosterAircraftId: '',
    rosterAircraftName: '',
    rosterAircraftRegistration: '',
    rosterAircraftPhotoUrl: '',
    rosterAircraftPhotoAttribution: '',
    rosterAircraftPhotoLinkback: '',
    rosterAircraftPhotoManual: false,
    rosterAircraftPhotoOffsetX: '0',
    rosterAircraftPhotoOffsetY: '0',
    rosterAircraftPhotoZoom: '100',
    curatedRosterTitle: 'Northern Shift Plan',
    curatedRosterLegs: 'UUEE - USRR\nUSRR - ULLI\nULLI - UUEE',
    curatedRosterDescription: defaultCuratedRosterDescription[locale],
    curatedRosterBonusPoints: '350',
    curatedRosterRegistrationRequired: false,
    curatedRosterAircraftEnabled: false,
    curatedRosterAircraftSearch: '',
    curatedRosterAircraftSource: '',
    curatedRosterAircraftId: '',
    curatedRosterAircraftName: '',
    curatedRosterAircraftRegistration: '',
    curatedRosterAircraftPhotoUrl: '',
    curatedRosterAircraftPhotoAttribution: '',
    curatedRosterAircraftPhotoLinkback: '',
    curatedRosterAircraftPhotoManual: false,
    curatedRosterAircraftPhotoOffsetX: '0',
    curatedRosterAircraftPhotoOffsetY: '0',
    curatedRosterAircraftPhotoZoom: '100',
    challengeName: 'Spring Community Challenge',
    challengeBonusPoints: '350',
    challengeRegistrationRequired: false,
    communityGoalName: 'April Community Goal',
    communityGoalDescription: defaultCommunityGoalDescription.en,
    communityGoalCountType: 'flights',
    communityGoalTargetAmount: '1200',
    communityGoalBonusPoints: '350',
    communityGoalRegistrationRequired: false,
  }
}

function createDefaultBadgeFormState(locale: Locale): BadgeFormState {
  return {
    title: locale === 'ru' ? 'Участник' : 'Participant',
    subtitle: locale === 'ru' ? 'Spring Event 2026' : 'Spring Event 2026',
    topLabel: locale === 'ru' ? 'EVENT' : 'EVENT',
    shape: 'circle',
    frame: 'ring',
    layerStyle: 'orbital',
    paletteMode: 'brand',
    icon: 'medal',
    backgroundColor: '#11161d',
    accentColor: '#d6181e',
    textColor: '#f4f7fb',
  }
}

const badgeBrandPalettes: Record<BrandKey, { backgroundColor: string; accentColor: string; textColor: string }> = {
  nordwind: {
    backgroundColor: '#11161d',
    accentColor: '#d6181e',
    textColor: '#f4f7fb',
  },
  rag: {
    backgroundColor: '#101822',
    accentColor: '#43bbd1',
    textColor: '#f4f8fb',
  },
}

const defaultCommunityTeams: CommunityTeam[] = [
  {
    id: 1,
    name: 'Team North Star',
    countType: 'flights',
    targetAmount: '150',
  },
  {
    id: 2,
    name: 'Team Meridian',
    countType: 'distance',
    targetAmount: '85000',
  },
  {
    id: 3,
    name: 'Team Horizon',
    countType: 'passengers',
    targetAmount: '5000',
  },
]

function cloneDefaultCommunityTeams() {
  return defaultCommunityTeams.map((team) => ({ ...team }))
}

const defaultVatsimRegionDivisionSelection = 'vatrus,vateud'

const vatspyTopLevelBoundaryFeatures = Array.from(
  new Map(
    ((((vatsimBoundariesGeoJson as unknown) as VatsimBoundaryCollection).features ?? [])
      .filter((feature) => isTopLevelFirBoundary(feature.properties.id))
      .map((feature) => {
        const boundaryId = feature.properties.id?.trim().toUpperCase()

        return boundaryId ? [boundaryId, feature] as const : null
      })
      .filter((entry): entry is readonly [string, VatsimBoundaryFeature] => entry !== null)),
  ).values(),
)

const vatsimRegionDivisionDefinitions: VatsimRegionDivisionDefinition[] = [
  {
    id: 'vatrus',
    code: 'VATRUS',
    labels: { ru: 'Россия и СНГ', en: 'Russia and CIS' },
  },
  {
    id: 'vateud',
    code: 'VATEUD',
    labels: { ru: 'Европа', en: 'Europe' },
  },
  {
    id: 'vatuk',
    code: 'VATUK',
    labels: { ru: 'Великобритания', en: 'United Kingdom' },
  },
  {
    id: 'vatmena',
    code: 'VATMENA',
    labels: { ru: 'Ближний Восток и Северная Африка', en: 'Middle East and North Africa' },
  },
  {
    id: 'vatssa',
    code: 'VATSSA',
    labels: { ru: 'Африка к югу от Сахары', en: 'Sub-Saharan Africa' },
  },
  {
    id: 'vatil',
    code: 'VATIL',
    labels: { ru: 'Израиль', en: 'Israel' },
  },
  {
    id: 'nat',
    code: 'NAT',
    labels: { ru: 'Северная Атлантика', en: 'North Atlantic' },
  },
  {
    id: 'emea',
    code: 'EMEA',
    labels: { ru: 'EMEA Core', en: 'EMEA Core' },
  },
  {
    id: 'vatwa',
    code: 'VATWA',
    labels: { ru: 'Западная Азия', en: 'West Asia' },
  },
  {
    id: 'vatsea',
    code: 'VATSEA',
    labels: { ru: 'Юго-Восточная Азия', en: 'Southeast Asia' },
  },
  {
    id: 'vatprc',
    code: 'VATPRC',
    labels: { ru: 'Китай', en: 'China' },
  },
  {
    id: 'vatroc',
    code: 'VATROC',
    labels: { ru: 'Тайвань', en: 'Taiwan' },
  },
  {
    id: 'vatjpn',
    code: 'VATJPN',
    labels: { ru: 'Япония', en: 'Japan' },
  },
  {
    id: 'vatkor',
    code: 'VATKOR',
    labels: { ru: 'Корея', en: 'Korea' },
  },
  {
    id: 'vatpac',
    code: 'VATPAC',
    labels: { ru: 'Тихий океан и Австралия', en: 'Pacific and Australia' },
  },
  {
    id: 'vatnz',
    code: 'VATNZ',
    labels: { ru: 'Новая Зеландия', en: 'New Zealand' },
  },
  {
    id: 'vatusa',
    code: 'VATUSA',
    labels: { ru: 'США', en: 'United States' },
  },
  {
    id: 'vatcan',
    code: 'VATCAN',
    labels: { ru: 'Канада', en: 'Canada' },
  },
  {
    id: 'vatmex',
    code: 'VATMEX',
    labels: { ru: 'Мексика', en: 'Mexico' },
  },
  {
    id: 'vatca',
    code: 'VATCA',
    labels: { ru: 'Центральная Америка', en: 'Central America' },
  },
  {
    id: 'vatcar',
    code: 'VATCAR',
    labels: { ru: 'Карибы', en: 'Caribbean' },
  },
  {
    id: 'vatsur',
    code: 'VATSUR',
    labels: { ru: 'Южная Америка', en: 'South America' },
  },
  {
    id: 'vatbrz',
    code: 'VATBRZ',
    labels: { ru: 'Бразилия', en: 'Brazil' },
  },
]

const vatsimRegionBoundaryPresetLabelOverrides: Partial<Record<string, Record<Locale, string>>> = {
  NAT: { ru: 'Северная Атлантика', en: 'North Atlantic' },
}

const manualVatsimRegionPresetDefinitions: VatsimRegionPresetDefinition[] = [
  {
    id: 'turkey',
    labels: { ru: 'Турция', en: 'Turkey' },
    divisionIds: ['vateud'],
    firIds: ['LTAA', 'LTBB'],
    traconPrefixes: ['LT'],
  },
  {
    id: 'caucasus',
    labels: { ru: 'Кавказ', en: 'Caucasus' },
    divisionIds: ['vatrus'],
    firIds: ['UGGG', 'UDDD', 'UBBA'],
    traconPrefixes: ['UG', 'UD', 'UB'],
  },
  {
    id: 'south-russia',
    labels: { ru: 'Юг РФ', en: 'South Russia' },
    divisionIds: ['vatrus'],
    firIds: ['URRV'],
    traconPrefixes: ['UR'],
  },
  {
    id: 'northwest-russia',
    labels: { ru: 'Северо-Запад РФ', en: 'Northwest Russia' },
    divisionIds: ['vatrus'],
    firIds: ['ULLL', 'UMKK'],
    traconPrefixes: [],
  },
  {
    id: 'belarus',
    labels: { ru: 'Беларусь', en: 'Belarus' },
    divisionIds: ['vatrus'],
    firIds: ['UMMV'],
    traconPrefixes: [],
  },
  {
    id: 'moscow',
    labels: { ru: 'Москва', en: 'Moscow' },
    divisionIds: ['vatrus'],
    firIds: ['UUWV'],
    traconPrefixes: [],
  },
  {
    id: 'volga',
    labels: { ru: 'Поволжье', en: 'Volga' },
    divisionIds: ['vatrus'],
    firIds: ['UWWW'],
    traconPrefixes: [],
  },
  {
    id: 'urals',
    labels: { ru: 'Урал и Тюмень', en: 'Urals and Tyumen' },
    divisionIds: ['vatrus'],
    firIds: ['USSV', 'USTV'],
    traconPrefixes: [],
  },
  {
    id: 'siberia',
    labels: { ru: 'Сибирь', en: 'Siberia' },
    divisionIds: ['vatrus'],
    firIds: ['UNNT', 'UNKL', 'UIII'],
    traconPrefixes: [],
  },
  {
    id: 'far-east',
    labels: { ru: 'Дальний Восток', en: 'Far East' },
    divisionIds: ['vatrus'],
    firIds: ['UEEE', 'UHHH', 'UHMM'],
    traconPrefixes: [],
  },
  {
    id: 'central-asia',
    labels: { ru: 'Центральная Азия', en: 'Central Asia' },
    divisionIds: ['vatrus'],
    firIds: ['UAAA', 'UACN', 'UAII', 'UATT', 'UCFM', 'UCFO', 'UTAA', 'UTAK', 'UTAT', 'UTAV', 'UTDD', 'UZSD', 'UZTR'],
    traconPrefixes: [],
  },
]

const manualVatsimRegionCoveredFirIds = new Set(
  manualVatsimRegionPresetDefinitions.flatMap((preset) => preset.firIds),
)

const vatsimRegionDivisionOrderById = new Map(
  vatsimRegionDivisionDefinitions.map((division, index) => [division.id, index] as const),
)

const vatsimRegionPresetDefinitions: VatsimRegionPresetDefinition[] = [
  ...manualVatsimRegionPresetDefinitions,
  ...vatspyTopLevelBoundaryFeatures
    .flatMap((feature) => {
      const boundaryId = feature.properties.id?.trim().toUpperCase()
      const divisionCode = feature.properties.division?.trim().toUpperCase()

      if (!boundaryId || !divisionCode || manualVatsimRegionCoveredFirIds.has(boundaryId)) {
        return []
      }

      const division = getDivisionDefinitionByCode(divisionCode)

      if (!division) {
        return []
      }

      return [
        {
          id: `boundary-${boundaryId.toLowerCase()}`,
          labels: vatsimRegionBoundaryPresetLabelOverrides[boundaryId] ?? { ru: boundaryId, en: boundaryId },
          divisionIds: [division.id],
          firIds: [boundaryId],
          traconPrefixes: [],
        },
      ]
    })
    .sort((leftPreset, rightPreset) => {
      const leftDivisionOrder = vatsimRegionDivisionOrderById.get(leftPreset.divisionIds[0]) ?? Number.MAX_SAFE_INTEGER
      const rightDivisionOrder = vatsimRegionDivisionOrderById.get(rightPreset.divisionIds[0]) ?? Number.MAX_SAFE_INTEGER

      if (leftDivisionOrder !== rightDivisionOrder) {
        return leftDivisionOrder - rightDivisionOrder
      }

      return leftPreset.labels.en.localeCompare(rightPreset.labels.en, 'en')
    }),
]

function parseSerializedSelection(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function serializeSelection(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).join(',')
}

function splitCompactMetaList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function getDivisionDefinitionById(divisionId: string) {
  return vatsimRegionDivisionDefinitions.find((division) => division.id === divisionId) ?? null
}

function getDivisionDefinitionByCode(divisionCode: string) {
  return vatsimRegionDivisionDefinitions.find((division) => division.code === divisionCode) ?? null
}

function getPresetDefinitionById(presetId: string) {
  return vatsimRegionPresetDefinitions.find((preset) => preset.id === presetId) ?? null
}

function getPresetDefinitionsForDivisions(divisionIds: string[]) {
  const divisionIdSet = new Set(divisionIds)

  return vatsimRegionPresetDefinitions.filter((preset) =>
    preset.divisionIds.some((divisionId) => divisionIdSet.has(divisionId)),
  )
}

function getDivisionCodes(divisionIds: string[]) {
  return divisionIds.flatMap((divisionId) => {
    const division = getDivisionDefinitionById(divisionId)
    return division ? [division.code] : []
  })
}

function getDivisionIdsFromText(value: string) {
  const divisionCodeSet = new Set(splitCompactMetaList(value).map((item) => item.toUpperCase()))

  return vatsimRegionDivisionDefinitions
    .filter((division) => divisionCodeSet.has(division.code))
    .map((division) => division.id)
}

function getPresetFirIds(presetIds: string[]) {
  return Array.from(
    new Set(
      presetIds.flatMap((presetId) => getPresetDefinitionById(presetId)?.firIds ?? []),
    ),
  )
}

function resolveSelectedFirIds(serializedSelection: string, availableFirIds: string[]) {
  if (availableFirIds.length === 0) {
    return []
  }

  const selectedFirIds = parseSerializedSelection(serializedSelection)

  if (selectedFirIds.length === 0) {
    return availableFirIds
  }

  const availableFirIdSet = new Set(availableFirIds)
  return selectedFirIds.filter((firId) => availableFirIdSet.has(firId))
}

function sanitizeStoredCommunityTeams(value: unknown) {
  if (!Array.isArray(value)) {
    return cloneDefaultCommunityTeams()
  }

  const normalizedTeams = value
    .map((team, index) => {
      if (!team || typeof team !== 'object') {
        return null
      }

      const teamRecord = team as Partial<CommunityTeam>

      return {
        id: typeof teamRecord.id === 'number' ? teamRecord.id : index + 1,
        name: typeof teamRecord.name === 'string' ? teamRecord.name : '',
        countType:
          teamRecord.countType && communityCountTypeOrder.includes(teamRecord.countType)
            ? teamRecord.countType
            : 'flights',
        targetAmount: typeof teamRecord.targetAmount === 'string' ? teamRecord.targetAmount : '',
      }
    })
    .filter((team): team is CommunityTeam => team !== null)

  return normalizedTeams.length > 0 ? normalizedTeams : cloneDefaultCommunityTeams()
}

function loadStoredBannerSettings(locale: Locale): {
  appMode: AppMode
  form: BannerFormState
  badgeForm: BadgeFormState
  communityTeams: CommunityTeam[]
} {
  const defaultState = {
    appMode: 'banner' as AppMode,
    form: createDefaultFormState(locale),
    badgeForm: createDefaultBadgeFormState(locale),
    communityTeams: cloneDefaultCommunityTeams(),
  }

  if (typeof window === 'undefined') {
    return defaultState
  }

  const rawValue = window.localStorage.getItem(bannerSettingsStorageKey)

  if (!rawValue) {
    return defaultState
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredBannerSettings
    const defaultForm = createDefaultFormState(locale)
    const defaultBadgeForm = createDefaultBadgeFormState(locale)
    const storedForm = parsedValue?.form && typeof parsedValue.form === 'object' ? parsedValue.form : {}
    const storedBadgeForm = parsedValue?.badgeForm && typeof parsedValue.badgeForm === 'object' ? parsedValue.badgeForm : {}
    const normalizedForm: BannerFormState = { ...defaultForm }
    const normalizedBadgeForm: BadgeFormState = { ...defaultBadgeForm }
    const mutableNormalizedForm = normalizedForm as Record<keyof BannerFormState, BannerFormState[keyof BannerFormState]>
    const mutableNormalizedBadgeForm =
      normalizedBadgeForm as Record<keyof BadgeFormState, BadgeFormState[keyof BadgeFormState]>

    for (const [field, fallbackValue] of Object.entries(defaultForm) as [keyof BannerFormState, BannerFormState[keyof BannerFormState]][]) {
      const nextValue = storedForm[field]

      if (typeof fallbackValue === 'boolean') {
        if (typeof nextValue === 'boolean') {
          mutableNormalizedForm[field] = nextValue
        }
      } else if (typeof nextValue === 'string') {
        mutableNormalizedForm[field] = nextValue
      }
    }

    const storedVatsimRegionDivisionSelection = storedForm.vatsimRegionDivisionSelection
    const normalizedVatsimRegionDivisionIds =
      typeof storedVatsimRegionDivisionSelection === 'string'
        ? parseSerializedSelection(storedVatsimRegionDivisionSelection).filter((divisionId) => getDivisionDefinitionById(divisionId))
        : (() => {
            const migratedDivisionIds = getDivisionIdsFromText(
              typeof storedForm.vatsimRegionPartners === 'string' ? storedForm.vatsimRegionPartners : '',
            )

            return migratedDivisionIds.length > 0
              ? migratedDivisionIds
              : parseSerializedSelection(defaultVatsimRegionDivisionSelection)
          })()

    mutableNormalizedForm.vatsimRegionDivisionSelection = serializeSelection(normalizedVatsimRegionDivisionIds)
    mutableNormalizedForm.vatsimRegionPartners = getDivisionCodes(normalizedVatsimRegionDivisionIds).join(', ')

    if (typeof storedVatsimRegionDivisionSelection !== 'string') {
      const storedVatsimRegionHosts = typeof storedForm.vatsimRegionHosts === 'string' ? storedForm.vatsimRegionHosts.trim() : ''

      if (storedVatsimRegionHosts === 'VATRUS, VATEUD') {
        mutableNormalizedForm.vatsimRegionHosts = ''
      }
    }

    for (const [field, fallbackValue] of Object.entries(defaultBadgeForm) as [keyof BadgeFormState, BadgeFormState[keyof BadgeFormState]][]) {
      const nextValue = storedBadgeForm[field]

      if (typeof fallbackValue === 'string' && typeof nextValue === 'string') {
        mutableNormalizedBadgeForm[field] = nextValue
      }
    }

    return {
      appMode: parsedValue?.appMode === 'badge' ? 'badge' : 'banner',
      form: normalizedForm,
      badgeForm: normalizedBadgeForm,
      communityTeams: sanitizeStoredCommunityTeams(parsedValue?.communityTeams),
    }
  } catch {
    return defaultState
  }
}

function isComplexEvent(eventType: EventType) {
  return eventType === 'event'
}

function isVatsimRegionEvent(eventType: EventType) {
  return eventType === 'vatsim-region'
}

const maxCommunityTeams = 4

const communityCountTypeOrder: ChallengeCountType[] = ['passengers', 'freight', 'flights', 'distance', 'flight-time']

const communityCountTypeLabels: Record<
  Locale,
  Record<ChallengeCountType, { label: string; unit: string }>
> = {
  ru: {
    passengers: { label: 'Пассажиры', unit: 'pax' },
    freight: { label: 'Груз', unit: 'lbs' },
    flights: { label: 'Рейсы', unit: 'PIREPs' },
    distance: { label: 'Дистанция', unit: 'nm' },
    'flight-time': { label: 'Налёт', unit: 'ч' },
  },
  en: {
    passengers: { label: 'Passengers', unit: 'pax' },
    freight: { label: 'Freight', unit: 'lbs' },
    flights: { label: 'Flights', unit: 'PIREPs' },
    distance: { label: 'Distance', unit: 'nm' },
    'flight-time': { label: 'Flight Time', unit: 'hrs' },
  },
}

const interfaceCopy: Record<Locale, InterfaceCopy> = {
  ru: {
    appTitle: 'Генератор VAC-баннеров',
    appDescription:
      'Единая платформа VAC-баннеров для Focus Airport, туров, roster, curated roster, Community Challenge и Community Goal для Nordwind Virtual и Russian Airways Group. Выберите проект, настройте тип ивента, проверьте превью и экспортируйте PNG 1920×1080.',
    projectLabel: 'Проект ВАК',
    backgroundSuggestionsLabel: 'Варианты от системы',
    backgroundRandomizeButton: 'Случайный вариант',
    backgroundRegenerateButton: 'Перегенерировать',
    backgroundSaveFavoriteButton: 'В избранное',
    backgroundFavoritesLabel: 'Избранное',
    backgroundFavoritesEmptyLabel: 'Сохранённые фоны появятся здесь.',
    backgroundRemoveFavoriteButton: 'Убрать',
    backgroundFavoriteLoadError: 'Не удалось загрузить сохранённый фон. Попробуйте ещё раз.',
    eventTypeLabel: 'Тип ивента',
    complexEventEventName: 'Совместный ивент',
    vatsimRegionEventName: 'VATSIM Regions',
    focusAirportEventName: 'Focus Airport',
    tourEventName: 'Тур',
    rosterEventName: 'Roster',
    curatedRosterEventName: 'Curated Roster',
    communityChallengeEventName: 'Community Challenge',
    communityGoalEventName: 'Community Goal',
    interfaceLanguageLabel: 'Язык интерфейса',
    bannerSettingsTitle: 'Параметры баннера',
    cityLabel: 'Город',
    countryCodeLabel: 'Код страны',
    icaoLabel: 'ICAO',
    bonusPointsLabel: 'Бонусные баллы',
    airportNameLabel: 'Название аэропорта',
    complexEventTitleLabel: 'Название общего ивента',
    complexEventTitlePlaceholder: 'Northern Bridge Joint Event',
    complexEventDescriptionLabel: 'Описание общего ивента',
    complexEventDescriptionHelp: 'Этот briefing используется для обоих проектов и выводится прямо над картой.',
    complexEventDescriptionPlaceholder: defaultComplexEventDescription.ru,
    complexEventVnwsLegsLabel: 'Леги vNWS',
    complexEventRagLegsLabel: 'Леги RAG',
    complexEventLegsHelp: 'По одному легу на строку. Карта покажет маршруты обоих проектов одновременно и окрасит их по проектам.',
    complexEventVnwsBonusLabel: 'Бонус vNWS',
    complexEventRagBonusLabel: 'Бонус RAG',
    complexEventProjectsLabel: 'Проекты и маршруты',
    vatsimRegionTitleLabel: 'Название VATSIM-ивента',
    vatsimRegionTitlePlaceholder: 'Cross-Region VATSIM Operations',
    vatsimRegionDescriptionLabel: 'Briefing ивента',
    vatsimRegionDescriptionHelp: 'Короткий briefing для совместного VATSIM-ивента с регионами и ATC coverage.',
    vatsimRegionDescriptionPlaceholder: defaultVatsimRegionDescription.ru,
    vatsimRegionHostsLabel: 'ACC / vACC / ARTCC',
    vatsimRegionHostsPlaceholder: 'Moscow ACC, Far East ARTCC',
    vatsimRegionPartnersLabel: 'Дивизионы',
    vatsimRegionPartnersPlaceholder: 'VATRUS, VATPAC',
    vatsimRegionRegionsTitle: 'Регионы и координация',
    vatsimRegionProjectsTitle: 'Маршруты проектов',
    vatsimRegionBonusLabel: 'Общий бонус VATSIM-ивента',
    vatsimRegionVnwsLegsLabel: 'Леги vNWS',
    vatsimRegionRagLegsLabel: 'Леги RAG',
    vatsimRegionLegsHelp: 'По одному легу на строку. Карта покажет общий VATSIM-сценарий, а леги будут раскрашены по проектам.',
    tourTitleLabel: 'Название тура',
    tourTitlePlaceholder: 'Northern Cross Tour',
    tourLegsLabel: 'Леги',
    tourStopsLabel: 'Точки',
    tourLegsHelp: 'По одному легу на строку. Пример: ULLI - UUEE',
    tourLegsPlaceholder: 'ULLI - UUEE\nUUEE - URSS\nURSS - ULLI',
    tourDescriptionLabel: 'Описание тура',
    tourDescriptionHelp: 'Этот текст выводится прямо в превью. Его можно использовать как короткое описание маршрута.',
    tourDescriptionPlaceholder: defaultTourDescription.ru,
    tourPreviewIntro: defaultTourDescription.ru,
    rosterTitleLabel: 'Название roster',
    rosterTitlePlaceholder: 'April Route Roster',
    rosterDescriptionLabel: 'Описание roster',
    rosterDescriptionHelp: 'Roster используется для простого выполнения набора легов без персонального сценария.',
    rosterDescriptionPlaceholder: defaultRosterDescription.ru,
    curatedRosterTitleLabel: 'Название curated roster',
    curatedRosterTitlePlaceholder: 'Northern Shift Plan',
    curatedRosterDescriptionLabel: 'Описание curated roster',
    curatedRosterDescriptionHelp: 'Используйте это поле как briefing: как слетать смену, в каком темпе и с какой идеей маршрута.',
    curatedRosterDescriptionPlaceholder: defaultCuratedRosterDescription.ru,
    aircraftAssignmentLabel: 'Конкретный самолёт',
    aircraftAssignmentHelp: 'Для roster и curated roster самолёты подтягиваются только из выбранного проекта: RAG или vNWS.',
    aircraftSearchLabel: 'ICAO код ВС или регистрация',
    aircraftSearchPlaceholder: 'B738, Boeing 737-800 или RA-73280',
    aircraftSearchHelp: 'Введите ICAO код типа ВС, модель или регистрацию. Список ниже берётся только из выбранного проекта.',
    aircraftListLabel: 'Список самолётов',
    aircraftAirlineFilterLabel: 'Фильтр по авиакомпании',
    aircraftAirlineFilterAllLabel: 'Все авиакомпании',
    aircraftListEmpty: 'База бортов пока пуста или по запросу ничего не найдено.',
    aircraftNameLabel: 'ICAO тип ВС',
    aircraftRegistrationLabel: 'Бортовая регистрация',
    aircraftPhotoLabel: 'Фото самолёта',
    aircraftPhotoHelp: 'Если указан конкретный борт, сервис подтягивает фото по регистрации и совмещает его с картой маршрута.',
    aircraftPhotoLoading: 'Подбираем варианты фото самолёта...',
    aircraftPhotoEmpty: 'Подходящие фото самолёта пока не найдены.',
    aircraftPhotoAttributionPrefix: 'Фото: ',
    aircraftPhotoAdjustLabel: 'Кадрирование фото',
    aircraftPhotoAdjustHelp: 'По умолчанию используется автоподгонка. Включите ручной режим, если нужно довести кадр вручную.',
    aircraftPhotoAdjustManualLabel: 'Ручной режим',
    aircraftPhotoOffsetXLabel: 'Сдвиг по X',
    aircraftPhotoOffsetYLabel: 'Сдвиг по Y',
    aircraftPhotoZoomLabel: 'Zoom',
    aircraftPhotoToggleMore: 'Показать все фото',
    aircraftPhotoToggleLess: 'Свернуть список',
    previewPhotoToolsLabel: 'Настройки фото',
    previewPhotoToolsHint: 'Быстрые правки прямо на превью.',
    previewPhotoToolsOpenLabel: 'Открыть настройки фото',
    previewPhotoDragHint: 'Ручной режим включён: фото можно двигать мышкой прямо на баннере.',
    previewPhotoResetButton: 'Сбросить кадр',
    previewMapToolsLabel: 'Карта',
    previewMapToolsHint: 'Ручной зум поверх автозума. Настройка сохраняется автоматически.',
    previewMapToolsOpenLabel: 'Открыть настройки карты',
    previewMapZoomLabel: 'Зум карты',
    previewMapOffsetXLabel: 'Горизонталь',
    previewMapOffsetYLabel: 'Вертикаль',
    previewMapResetButton: 'Сбросить вид',
    previewMapPanHint: 'Карту можно двигать мышкой прямо на превью.',
    previewMapDetailLabel: 'Детализация',
    previewMapDetailFirLabel: 'Только FIR',
    previewMapDetailFirTmaLabel: 'FIR + TMA',
    previewMapThemeLabel: 'Тема карты',
    previewMapThemeClassicLabel: 'Тёмная',
    previewMapThemeSteelLabel: 'Светлая',
    previewMapThemeAuroraLabel: 'Спутник',
    curatedRosterVisualLabel: 'Визуал на баннере',
    curatedRosterVisualMapLabel: 'Карта',
    curatedRosterVisualAircraftLabel: 'Самолёт',
    complexEventVisualLabel: 'Карта общего ивента',
    complexEventVisualHelp: 'Для Complex Event используется встроенная карта: vNWS леги выделяются красным, RAG леги цианом.',
    complexEventVisualDisplay: 'Встроенная карта двух проектов',
    vatsimRegionVisualLabel: 'Карта VATSIM-регионов',
    vatsimRegionVisualHelp: 'Режим VATSIM Regions использует встроенную совместную карту, блок регионов и цветные леги по проектам.',
    vatsimRegionVisualDisplay: 'Встроенная карта VATSIM Regions',
    tourVisualLabel: 'Карта маршрута',
    tourVisualHelp:
      'Для route-ивентов по умолчанию используется встроенная векторная карта мира, а точки маршрута ставятся по координатам аэропортов из введённых легов. При необходимости можно загрузить свой фон.',
    tourAutoVisualDisplay: 'Встроенная карта маршрута',
    challengeNameLabel: 'Название челленджа',
    challengeNamePlaceholder: 'Spring Community Challenge',
    communityTeamsTitle: 'Команды',
    communityTeamsHelp: 'Для баннера отображаются первые 4 команды. У каждой команды свой тип цели и целевое значение.',
    communityTeamLabel: 'Команда',
    communityTeamFallbackName: 'Команда',
    communityTeamNameLabel: 'Название команды',
    communityTeamCountTypeLabel: 'Что считаем',
    communityTeamTargetLabel: 'Цель',
    communityAddTeamButton: 'Добавить команду',
    communityRemoveTeamButton: 'Удалить',
    communityGoalNameLabel: 'Название общей цели',
    communityGoalNamePlaceholder: 'April Community Goal',
    communityGoalDescriptionLabel: 'Описание на баннере',
    communityGoalDescriptionHelp: 'Этот текст отображается под заголовком Community Goal в превью и PNG.',
    communityGoalDescriptionPlaceholder: defaultCommunityGoalDescription.ru,
    communityGoalCountTypeLabel: 'Что считаем',
    communityGoalTargetLabel: 'Общая цель',
    communityGoalHelp: 'Это общий счётчик для всей комьюнити без разделения на команды.',
    communityVisualLabel: 'Фон баннера',
    communityVisualHelp:
      'Для community-ивентов по умолчанию используется встроенный фон баннера. При необходимости можно загрузить свой арт.',
    communityAutoVisualDisplay: 'Встроенный фон ивента',
    imagesTitle: 'Изображения',
    cityPhotoLabel: 'Фото города',
    cityPhotoHelp:
      'Генератор предлагает 3-4 варианта с видами города из Wikimedia Commons. Кадры аэропорта используются только как запасной fallback. Если ни один вариант не подходит, загрузите свой кадр.',
    choosePhotoButton: 'Загрузить своё фото',
    defaultBackgroundDisplay: 'Встроенный запасной фон',
    restoreDefaultBackgroundButton: 'Вернуть автоподбор',
    autoBackgroundLoadingLabel: 'Подбираем фон автоматически...',
    autoBackgroundDisplayPrefix: 'Авто: ',
    autoBackgroundEmptyLabel: 'Автоподбор не нашёл подходящий кадр, используется запасной фон',
    autoBackgroundErrorLabel: 'Автоподбор недоступен, используется запасной фон',
    logoLabel: 'Логотип проекта',
    logoHelp: 'Логотип выбранного проекта встроен и автоматически используется в превью и экспорте.',
    defaultLogoDisplayPrefix: 'Встроенный логотип: ',
    exportTitle: 'Экспорт',
    exportHelp: 'PNG 1920×1080. В экспорт автоматически подставляется логотип выбранного проекта.',
    exportPngButton: 'Экспорт PNG',
    exportingButton: 'Экспортируем…',
    previewLabel: 'Превью',
    previewTitle: 'Превью баннера / 1920×1080',
    resolutionChip: 'PNG • 16:9',
    rewardLabel: 'Награда ивента',
    rewardPrefix: 'Получите дополнительно',
    rewardSuffix: 'бонусных баллов',
    rewardTextLabel: 'Текст награды',
    rewardTextPrefixLabel: 'Текст до числа',
    rewardTextSuffixLabel: 'Текст после числа',
    rewardTextHelp: 'Эта фраза используется в крупной reward-строке на баннере.',
    vatsimEventLabel: 'VATSIM Event',
    vatsimEventHelp: 'Если включено, на баннере появится отдельная метка VATSIM Event.',
    vatsimEventBadge: 'VATSIM Event',
    registrationRequiredLabel: 'Registration Required',
    registrationRequiredHelp: 'Если включено, на баннере появится заметка о том, что для участия нужна предварительная регистрация.',
    registrationRequiredBadge: 'Требуется регистрация',
    tourPreviewLabel: 'Леги тура',
    tourPreviewEmpty: 'Добавьте хотя бы один лег',
    rosterPreviewLabel: 'Леги roster',
    rosterPreviewEmpty: 'Добавьте хотя бы один leg в roster',
    curatedRosterPreviewLabel: 'Curated legs',
    curatedRosterPreviewEmpty: 'Добавьте хотя бы один leg в curated roster',
    communityPreviewLabel: 'Команды челленджа',
    communityPreviewIntro: 'Выберите команду и помогите ей первой выполнить общую цель.',
    communityPreviewEmpty: 'Добавьте хотя бы одну команду',
    communityGoalPreviewLabel: 'Общая цель',
    communityGoalPreviewIntro: 'Вся комьюнити летает в один общий счётчик до достижения цели.',
    complexEventPreviewLabel: 'Маршруты проектов',
    complexEventPreviewEmpty: 'Добавьте хотя бы один лег для vNWS или RAG',
    vatsimRegionPreviewLabel: 'Сценарий VATSIM Regions',
    vatsimRegionPreviewEmpty: 'Добавьте хотя бы один лег для VATSIM Regions',
    logoAriaLabel: 'Логотип проекта',
    logoOverlayLabel: 'Затемнение за логотипом',
    logoOverlayHelp: 'Управляет прозрачностью тени под логотипом.',
    exportError: 'Не удалось экспортировать PNG. Проверьте загруженные изображения и попробуйте еще раз.',
  },
  en: {
    appTitle: 'VA Banner Generator',
    appDescription:
      'One banner platform for Focus Airport, tour events, roster events, curated rosters, Community Challenge banners, and Community Goal banners for Nordwind Virtual and Russian Airways Group. Select the project, choose the event type, review the live preview, and export a 1920×1080 PNG.',
    projectLabel: 'VA Project',
    backgroundSuggestionsLabel: 'System Picks',
    backgroundRandomizeButton: 'Randomize',
    backgroundRegenerateButton: 'Regenerate',
    backgroundSaveFavoriteButton: 'Save to Favorites',
    backgroundFavoritesLabel: 'Favorites',
    backgroundFavoritesEmptyLabel: 'Saved backgrounds will appear here.',
    backgroundRemoveFavoriteButton: 'Remove',
    backgroundFavoriteLoadError: 'Failed to load the saved background. Try again.',
    eventTypeLabel: 'Event Type',
    complexEventEventName: 'Joint Event',
    vatsimRegionEventName: 'VATSIM Regions',
    focusAirportEventName: 'Focus Airport',
    tourEventName: 'Tour',
    rosterEventName: 'Roster',
    curatedRosterEventName: 'Curated Roster',
    communityChallengeEventName: 'Community Challenge',
    communityGoalEventName: 'Community Goal',
    interfaceLanguageLabel: 'Interface language',
    bannerSettingsTitle: 'Banner Settings',
    cityLabel: 'City',
    countryCodeLabel: 'Country Code',
    icaoLabel: 'ICAO',
    bonusPointsLabel: 'Bonus Points',
    airportNameLabel: 'Airport Name',
    complexEventTitleLabel: 'Shared Event Title',
    complexEventTitlePlaceholder: 'Northern Bridge Joint Event',
    complexEventDescriptionLabel: 'Shared Event Briefing',
    complexEventDescriptionHelp: 'This briefing is shared by both projects and appears directly above the map.',
    complexEventDescriptionPlaceholder: defaultComplexEventDescription.en,
    complexEventVnwsLegsLabel: 'vNWS Legs',
    complexEventRagLegsLabel: 'RAG Legs',
    complexEventLegsHelp: 'One leg per line. The map shows both project routes at once and colors them by project.',
    complexEventVnwsBonusLabel: 'vNWS Bonus',
    complexEventRagBonusLabel: 'RAG Bonus',
    complexEventProjectsLabel: 'Projects and Routes',
    vatsimRegionTitleLabel: 'VATSIM Event Title',
    vatsimRegionTitlePlaceholder: 'Cross-Region VATSIM Operations',
    vatsimRegionDescriptionLabel: 'Event Briefing',
    vatsimRegionDescriptionHelp: 'A short briefing for a joint VATSIM event built around regional cooperation and ATC coverage.',
    vatsimRegionDescriptionPlaceholder: defaultVatsimRegionDescription.en,
    vatsimRegionHostsLabel: 'ACC / vACC / ARTCC',
    vatsimRegionHostsPlaceholder: 'Moscow ACC, Far East ARTCC',
    vatsimRegionPartnersLabel: 'Divisions',
    vatsimRegionPartnersPlaceholder: 'VATRUS, VATPAC',
    vatsimRegionRegionsTitle: 'Regions and Coordination',
    vatsimRegionProjectsTitle: 'Project Routes',
    vatsimRegionBonusLabel: 'Shared VATSIM Bonus',
    vatsimRegionVnwsLegsLabel: 'vNWS Legs',
    vatsimRegionRagLegsLabel: 'RAG Legs',
    vatsimRegionLegsHelp: 'One leg per line. The map presents the shared VATSIM scenario and colors the routes by project.',
    tourTitleLabel: 'Tour Title',
    tourTitlePlaceholder: 'Northern Cross Tour',
    tourLegsLabel: 'Legs',
    tourStopsLabel: 'Stops',
    tourLegsHelp: 'One leg per line. Example: ULLI - UUEE',
    tourLegsPlaceholder: 'ULLI - UUEE\nUUEE - URSS\nURSS - ULLI',
    tourDescriptionLabel: 'Tour Description',
    tourDescriptionHelp: 'This text is shown directly in the preview. Use it as a short route description or event note.',
    tourDescriptionPlaceholder: defaultTourDescription.en,
    tourPreviewIntro: defaultTourDescription.en,
    rosterTitleLabel: 'Roster Title',
    rosterTitlePlaceholder: 'April Route Roster',
    rosterDescriptionLabel: 'Roster Description',
    rosterDescriptionHelp: 'Use roster mode for a straightforward legs-only activity with no personal shift narrative.',
    rosterDescriptionPlaceholder: defaultRosterDescription.en,
    curatedRosterTitleLabel: 'Curated Roster Title',
    curatedRosterTitlePlaceholder: 'Northern Shift Plan',
    curatedRosterDescriptionLabel: 'Curated Briefing',
    curatedRosterDescriptionHelp: 'Use this as a personal shift note: how to fly the sequence, what the shift is about, and what to focus on.',
    curatedRosterDescriptionPlaceholder: defaultCuratedRosterDescription.en,
    aircraftAssignmentLabel: 'Specific aircraft',
    aircraftAssignmentHelp: 'Roster and Curated Roster pull aircraft only from the selected project: RAG or vNWS.',
    aircraftSearchLabel: 'Aircraft ICAO code or registration',
    aircraftSearchPlaceholder: 'B738, Boeing 737-800, or RA-73280',
    aircraftSearchHelp: 'Enter an aircraft type ICAO code, model, or registration. The list below uses only the selected project.',
    aircraftListLabel: 'Aircraft list',
    aircraftAirlineFilterLabel: 'Airline filter',
    aircraftAirlineFilterAllLabel: 'All airlines',
    aircraftListEmpty: 'No aircraft were loaded yet or nothing matched the current query.',
    aircraftNameLabel: 'Aircraft ICAO type',
    aircraftRegistrationLabel: 'Aircraft registration',
    aircraftPhotoLabel: 'Aircraft photo',
    aircraftPhotoHelp: 'When a specific airframe is set, the service looks up aircraft photos by registration and blends them with the route map.',
    aircraftPhotoLoading: 'Looking up aircraft photo options...',
    aircraftPhotoEmpty: 'No suitable aircraft photos were found yet.',
    aircraftPhotoAttributionPrefix: 'Photo: ',
    aircraftPhotoAdjustLabel: 'Photo Framing',
    aircraftPhotoAdjustHelp: 'Auto-fit is used by default. Enable manual mode if you want to fine-tune the crop yourself.',
    aircraftPhotoAdjustManualLabel: 'Manual mode',
    aircraftPhotoOffsetXLabel: 'X offset',
    aircraftPhotoOffsetYLabel: 'Y offset',
    aircraftPhotoZoomLabel: 'Zoom',
    aircraftPhotoToggleMore: 'Show all photos',
    aircraftPhotoToggleLess: 'Collapse list',
    previewPhotoToolsLabel: 'Photo Tools',
    previewPhotoToolsHint: 'Quick framing controls directly on the preview.',
    previewPhotoToolsOpenLabel: 'Open photo tools',
    previewPhotoDragHint: 'Manual mode is on. Drag the aircraft photo directly on the banner.',
    previewPhotoResetButton: 'Reset framing',
    previewMapToolsLabel: 'Map Tools',
    previewMapToolsHint: 'Manual zoom on top of auto-zoom. This setting is saved automatically.',
    previewMapToolsOpenLabel: 'Open map tools',
    previewMapZoomLabel: 'Map zoom',
    previewMapOffsetXLabel: 'Horizontal pan',
    previewMapOffsetYLabel: 'Vertical pan',
    previewMapResetButton: 'Reset view',
    previewMapPanHint: 'You can drag the map directly in the preview.',
    previewMapDetailLabel: 'Detail level',
    previewMapDetailFirLabel: 'FIR only',
    previewMapDetailFirTmaLabel: 'FIR + TMA',
    previewMapThemeLabel: 'Map theme',
    previewMapThemeClassicLabel: 'Dark',
    previewMapThemeSteelLabel: 'Light',
    previewMapThemeAuroraLabel: 'Satellite',
    curatedRosterVisualLabel: 'Banner visual',
    curatedRosterVisualMapLabel: 'Map',
    curatedRosterVisualAircraftLabel: 'Aircraft',
    complexEventVisualLabel: 'Shared Event Map',
    complexEventVisualHelp: 'Complex Event uses a built-in map: vNWS legs are highlighted in red, RAG legs in cyan.',
    complexEventVisualDisplay: 'Built-in dual-project map',
    vatsimRegionVisualLabel: 'VATSIM Regions Map',
    vatsimRegionVisualHelp: 'VATSIM Regions uses a built-in joint map, a region coordination block, and project-colored legs.',
    vatsimRegionVisualDisplay: 'Built-in VATSIM Regions map',
    tourVisualLabel: 'Route Map',
    tourVisualHelp:
      'Route-based banners use a built-in vector world map by default, and route points are placed using the airport coordinates from the legs you enter. You can still upload a custom background if needed.',
    tourAutoVisualDisplay: 'Built-in route map',
    challengeNameLabel: 'Challenge Name',
    challengeNamePlaceholder: 'Spring Community Challenge',
    communityTeamsTitle: 'Teams',
    communityTeamsHelp: 'The banner shows the first 4 teams. Each team has its own goal type and target amount.',
    communityTeamLabel: 'Team',
    communityTeamFallbackName: 'Team',
    communityTeamNameLabel: 'Team Name',
    communityTeamCountTypeLabel: 'Count Type',
    communityTeamTargetLabel: 'Target Amount',
    communityAddTeamButton: 'Add Team',
    communityRemoveTeamButton: 'Remove',
    communityGoalNameLabel: 'Shared Goal Name',
    communityGoalNamePlaceholder: 'April Community Goal',
    communityGoalDescriptionLabel: 'Banner Description',
    communityGoalDescriptionHelp: 'This text appears under the Community Goal title in the preview and exported PNG.',
    communityGoalDescriptionPlaceholder: defaultCommunityGoalDescription.en,
    communityGoalCountTypeLabel: 'Count Type',
    communityGoalTargetLabel: 'Shared Target',
    communityGoalHelp: 'This is one shared counter for the whole community with no team split.',
    communityVisualLabel: 'Banner Background',
    communityVisualHelp:
      'Community events use a built-in banner background by default. Upload your own artwork only if you need a custom visual.',
    communityAutoVisualDisplay: 'Built-in event background',
    imagesTitle: 'Images',
    cityPhotoLabel: 'City Photo',
    cityPhotoHelp:
      'The generator offers 3-4 city-view background suggestions from Wikimedia Commons. Airport shots are used only as a fallback. If none of them fit, upload your own image.',
    choosePhotoButton: 'Upload Your Photo',
    defaultBackgroundDisplay: 'Built-in fallback background',
    restoreDefaultBackgroundButton: 'Restore Auto Background',
    autoBackgroundLoadingLabel: 'Selecting background automatically...',
    autoBackgroundDisplayPrefix: 'Auto: ',
    autoBackgroundEmptyLabel: 'Auto selection found no suitable image, using the fallback background',
    autoBackgroundErrorLabel: 'Auto selection is unavailable, using the fallback background',
    logoLabel: 'Project Logo',
    logoHelp: 'The selected project logo is built in and used automatically in preview and export.',
    defaultLogoDisplayPrefix: 'Built-in logo: ',
    exportTitle: 'Export',
    exportHelp: 'PNG 1920×1080. The selected project logo is used automatically for export.',
    exportPngButton: 'Export PNG',
    exportingButton: 'Exporting…',
    previewLabel: 'Live Preview',
    previewTitle: 'Banner Preview / 1920×1080',
    resolutionChip: 'PNG • 16:9',
    rewardLabel: 'Event reward',
    rewardPrefix: 'Earn additional',
    rewardSuffix: 'bonus points',
    rewardTextLabel: 'Reward text',
    rewardTextPrefixLabel: 'Text before number',
    rewardTextSuffixLabel: 'Text after number',
    rewardTextHelp: 'This phrase is used in the large reward line on the banner.',
    vatsimEventLabel: 'VATSIM Event',
    vatsimEventHelp: 'When enabled, the banner shows a dedicated VATSIM Event badge.',
    vatsimEventBadge: 'VATSIM Event',
    registrationRequiredLabel: 'Registration Required',
    registrationRequiredHelp: 'When enabled, the banner shows a visible note that event registration is required.',
    registrationRequiredBadge: 'Registration required',
    tourPreviewLabel: 'Tour legs',
    tourPreviewEmpty: 'Add at least one leg',
    rosterPreviewLabel: 'Roster legs',
    rosterPreviewEmpty: 'Add at least one roster leg',
    curatedRosterPreviewLabel: 'Curated legs',
    curatedRosterPreviewEmpty: 'Add at least one curated leg',
    communityPreviewLabel: 'Challenge teams',
    communityPreviewIntro: 'Pick a team and help it reach the shared target first.',
    communityPreviewEmpty: 'Add at least one team',
    communityGoalPreviewLabel: 'Shared target',
    communityGoalPreviewIntro: 'The whole community flies toward one shared counter until the goal is reached.',
    complexEventPreviewLabel: 'Project routes',
    complexEventPreviewEmpty: 'Add at least one leg for vNWS or RAG',
    vatsimRegionPreviewLabel: 'VATSIM Regions scenario',
    vatsimRegionPreviewEmpty: 'Add at least one leg for the VATSIM Regions event',
    logoAriaLabel: 'Project logo',
    logoOverlayLabel: 'Logo background dimming',
    logoOverlayHelp: 'Controls the opacity of the shadow behind the logo.',
    exportError: 'PNG export failed. Check uploaded images and try again.',
  },
}

const guideCopy: Record<Locale, GuideCopy> = {
  ru: {
    title: 'Как пользоваться сервисом',
    close: 'Закрыть',
    intro:
      'Сервис собирает баннеры под несколько форматов ивентов. Язык интерфейса и язык текста на баннере разделены: RU/EN меняет только controls, а язык баннера выбирается отдельно.',
    complexEvent: 'Complex Event: общий режим для vNWS и RAG с двумя наборами легов на одной карте и цветным разделением маршрутов по проектам.',
    vatsimRegion: 'VATSIM Regions: совместный режим для ивентов с регионами VATSIM, ATC coverage, списком хост-регионов и общей картой по проектам.',
    focusAirport: 'Focus Airport: классический баннер по городу и аэропорту с акцентом на визуал направления.',
    tour: 'Tour: маршрутная история на карте мира, где важны леги и последовательность точек.',
    roster: 'Roster: опубликованный список легов. Можно привязать ивент к конкретному самолёту и подтянуть фото борта.',
    curatedRoster: 'Curated Roster: персональный маршрут смены с briefing-логикой и привязкой к конкретному самолёту.',
    communityChallenge: 'Community Challenge: командный ивент, где команды соревнуются по выбранной метрике.',
    communityGoal: 'Community Goal: общий счётчик для всей комьюнити без разделения на команды.',
    archiveTitle: 'История',
    archiveEmpty: 'История пока пуста. Она начнет заполняться после экспорта баннеров.',
    archiveLoadError: 'Не удалось загрузить историю.',
  },
  en: {
    title: 'How To Use The Service',
    close: 'Close',
    intro:
      'This service builds banners for several event formats. Interface language and banner language are now separate: RU/EN changes the controls only, while banner text language is selected independently.',
    complexEvent: 'Complex Event: a shared vNWS and RAG mode with two route sets on one map and project-colored legs.',
    vatsimRegion: 'VATSIM Regions: a joint mode for events with VATSIM regions, ATC coverage, host-region metadata, and a shared project map.',
    focusAirport: 'Focus Airport: the classic city-and-airport banner with a strong destination visual.',
    tour: 'Tour: a route-driven story on the world map where leg order and stop sequence matter.',
    roster: 'Roster: a published sequence of legs. It can be tied to a specific aircraft and enriched with an aircraft photo.',
    curatedRoster: 'Curated Roster: a personal shift plan with briefing-style text and a specific airframe.',
    communityChallenge: 'Community Challenge: a team-based format where multiple teams compete on a selected metric.',
    communityGoal: 'Community Goal: one shared community-wide target with no team split.',
    archiveTitle: 'History',
    archiveEmpty: 'History is empty for now. It will start filling up after banner exports.',
    archiveLoadError: 'Failed to load history.',
  },
}

type EventDefinition = {
  key: EventType
  shortName: string
  exportSlug: string
}

const eventOrder: EventType[] = [
  'event',
  'vatsim-region',
  'focus-airport',
  'tour',
  'roster',
  'curated-roster',
  'community-challenge',
  'community-goal',
]

const eventDefinitions: Record<EventType, EventDefinition> = {
  event: {
    key: 'event',
    shortName: 'DUAL',
    exportSlug: 'complex-event',
  },
  'vatsim-region': {
    key: 'vatsim-region',
    shortName: 'VTM',
    exportSlug: 'vatsim-region',
  },
  'focus-airport': {
    key: 'focus-airport',
    shortName: 'FA',
    exportSlug: 'focus-airport',
  },
  tour: {
    key: 'tour',
    shortName: 'TOUR',
    exportSlug: 'tour',
  },
  roster: {
    key: 'roster',
    shortName: 'RST',
    exportSlug: 'roster',
  },
  'curated-roster': {
    key: 'curated-roster',
    shortName: 'CUR',
    exportSlug: 'curated-roster',
  },
  'community-challenge': {
    key: 'community-challenge',
    shortName: 'CC',
    exportSlug: 'community-challenge',
  },
  'community-goal': {
    key: 'community-goal',
    shortName: 'CG',
    exportSlug: 'community-goal',
  },
}

type BrandDefinition = {
  key: BrandKey
  fullName: string
  shortName: string
  exportSlug: string
}

const brandOrder: BrandKey[] = ['nordwind', 'rag']

const brandDefinitions: Record<BrandKey, BrandDefinition> = {
  nordwind: {
    key: 'nordwind',
    fullName: 'Nordwind Virtual',
    shortName: 'vNWS',
    exportSlug: 'nordwind-virtual',
  },
  rag: {
    key: 'rag',
    fullName: 'Russian Airways Group',
    shortName: 'RAG',
    exportSlug: 'russian-airways-group',
  },
}

type BackgroundInfo =
  | { kind: 'fallback' }
  | { kind: 'manual'; label: string }
  | { kind: 'auto'; label: string }
  | { kind: 'auto-empty' }
  | { kind: 'auto-error' }

type AutoBackgroundOption = {
  key: string
  objectUrl: string
  label: string
  sourceUrl: string
}

type CachedAutoBackground = {
  options: AutoBackgroundOption[]
}

type FavoriteBackground = {
  key: string
  label: string
  sourceUrl: string
  createdAt: number
}

type WikimediaCandidate = {
  title: string
  thumbUrl: string
  width: number
  height: number
  categories: string[]
}

type TourLegPair = {
  from: string
  to: string
}

type AirportCoordinateRecord = {
  name?: string | null
  city?: string | null
  country?: string | null
  iata?: string | null
  icao?: string | null
  latitude?: number | null
  longitude?: number | null
  type?: string | null
}

type AirportCoordinate = {
  latitude: number
  longitude: number
}

type AirportCatalogOption = {
  name: string
  city: string
  countryCode: string
  iata: string | null
  icao: string
  type: string | null
}

type TourMapPoint = {
  code: string
  latitude: number
  longitude: number
  x: number
  y: number
}

type TourMapRouteTone = 'default' | 'vnws' | 'rag'

type TourMapLeg = TourLegPair & {
  tone?: TourMapRouteTone
}

type TourMapSegment = {
  key: string
  path: string
  tone: TourMapRouteTone
}

type GeoJsonPosition = [number, number]
type GeoJsonLinearRing = GeoJsonPosition[]
type GeoJsonPolygonCoordinates = GeoJsonLinearRing[]
type GeoJsonMultiPolygonCoordinates = GeoJsonPolygonCoordinates[]

type VatsimBoundaryFeature = {
  type: 'Feature'
  properties: {
    id?: string
    oceanic?: string | number
    label_lon?: string | number
    label_lat?: string | number
    region?: string | null
    division?: string | null
  }
  geometry:
    | {
        type: 'Polygon'
        coordinates: GeoJsonPolygonCoordinates
      }
    | {
        type: 'MultiPolygon'
        coordinates: GeoJsonMultiPolygonCoordinates
      }
}

type VatsimBoundaryCollection = {
  features: VatsimBoundaryFeature[]
}

type SimawareBoundaryFeature = {
  type: 'Feature'
  properties: {
    id?: string
    prefix?: string[]
    suffix?: string
    name?: string
  }
  geometry:
    | {
        type: 'Polygon'
        coordinates: GeoJsonPolygonCoordinates
      }
    | {
        type: 'MultiPolygon'
        coordinates: GeoJsonMultiPolygonCoordinates
      }
}

type SimawareBoundaryRecord = {
  sourcePath: string
  feature: SimawareBoundaryFeature
}

type SimawareBoundaryCollection = {
  features: SimawareBoundaryRecord[]
}

type BoundaryGeometry = VatsimBoundaryFeature['geometry'] | SimawareBoundaryFeature['geometry']

type TourMapRegionOverlay = {
  key: string
  label: string
  fill: string
  stroke: string
  path: string
  showLabel: boolean
  labelPoint: {
    x: number
    y: number
  } | null
  viewportPoints: Array<{
    x: number
    y: number
  }>
  labelPriority: number
}

type TourMapProjectedBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type TourMapProjectedAreaFeature = {
  key: string
  path: string
  area: number
  bounds: TourMapProjectedBounds
}

type TourMapProjectedLineFeature = {
  key: string
  path: string
  bounds: TourMapProjectedBounds
  scaleRank: number
}

type TourMapMountainRange = TourMapProjectedAreaFeature
type TourMapLake = TourMapProjectedAreaFeature
type TourMapSteppeRegion = TourMapProjectedAreaFeature
type TourMapRiver = TourMapProjectedLineFeature

type TourMapViewport = {
  scale: number
  translateX: number
  translateY: number
}

type TourMapLabelPlacement = {
  textAnchor: 'start' | 'middle' | 'end'
  x: number
  y: number
  showFlag: boolean
  flagX: number
  flagY: number
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  flagBounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  } | null
}

type AircraftPhotoLayout = {
  size: string
  positionX: string
  positionY: string
}

type VatsimRegionDivisionDefinition = {
  id: string
  code: string
  labels: Record<Locale, string>
}

type VatsimRegionPresetDefinition = {
  id: string
  labels: Record<Locale, string>
  divisionIds: string[]
  firIds: string[]
  traconPrefixes: string[]
}

type VatsimRegionSelectionOption = {
  id: string
  title: string
  meta?: string
  aliases: string[]
}

type VatsimRegionDropdownTarget = 'division' | 'preset' | 'fir'

function normalizeVatsimRegionSelectionAlias(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

function resolveVatsimRegionSelectionInput(value: string, options: VatsimRegionSelectionOption[]) {
  const optionLookup = new Map<string, string>()

  options.forEach((option) => {
    ;[option.id, option.title, option.meta ?? '', ...option.aliases].forEach((alias) => {
      const normalizedAlias = normalizeVatsimRegionSelectionAlias(alias)

      if (normalizedAlias.length > 0 && !optionLookup.has(normalizedAlias)) {
        optionLookup.set(normalizedAlias, option.id)
      }
    })
  })

  return Array.from(
    new Set(
      splitCompactMetaList(value).flatMap((token) => {
        const optionId = optionLookup.get(normalizeVatsimRegionSelectionAlias(token))
        return optionId ? [optionId] : []
      }),
    ),
  )
}

function filterVatsimRegionSelectionOptions(value: string, options: VatsimRegionSelectionOption[]) {
  const normalizedQuery = normalizeVatsimRegionSelectionAlias(value)

  if (normalizedQuery.length === 0) {
    return options
  }

  return options.filter((option) =>
    [option.id, option.title, option.meta ?? '', ...option.aliases].some((candidate) =>
      normalizeVatsimRegionSelectionAlias(candidate).includes(normalizedQuery),
    ),
  )
}

function normalizeVatsimRegionDivisionIds(divisionIds: string[]) {
  const divisionIdSet = new Set(divisionIds)

  return vatsimRegionDivisionDefinitions
    .filter((division) => divisionIdSet.has(division.id))
    .map((division) => division.id)
}

function normalizeVatsimRegionPresetIds(presetIds: string[], availablePresetIds: string[]) {
  const presetIdSet = new Set(presetIds)
  return availablePresetIds.filter((presetId) => presetIdSet.has(presetId))
}

function normalizeVatsimRegionFirIds(firIds: string[], availableFirIds: string[]) {
  const firIdSet = new Set(firIds)
  return availableFirIds.filter((firId) => firIdSet.has(firId))
}

function buildVatsimRegionSelectionState(
  current: BannerFormState,
  nextValues: {
    divisionIds?: string[]
    presetIds?: string[]
    firIds?: string[]
  },
) {
  const normalizedDivisionIds = normalizeVatsimRegionDivisionIds(
    nextValues.divisionIds ?? parseSerializedSelection(current.vatsimRegionDivisionSelection),
  )
  const availablePresetIds = getPresetDefinitionsForDivisions(normalizedDivisionIds).map((preset) => preset.id)
  const normalizedPresetIds = normalizeVatsimRegionPresetIds(
    nextValues.presetIds ?? parseSerializedSelection(current.vatsimRegionPresetSelection),
    availablePresetIds,
  )
  const availableFirIds = getPresetFirIds(normalizedPresetIds)
  const normalizedFirIds = normalizeVatsimRegionFirIds(
    nextValues.firIds ?? parseSerializedSelection(current.vatsimRegionFirSelection),
    availableFirIds,
  )

  return {
    ...current,
    vatsimRegionPartners: getDivisionCodes(normalizedDivisionIds).join(', '),
    vatsimRegionDivisionSelection: serializeSelection(normalizedDivisionIds),
    vatsimRegionPresetSelection: serializeSelection(normalizedPresetIds),
    vatsimRegionFirSelection:
      normalizedPresetIds.length === 0 || normalizedFirIds.length === 0 || normalizedFirIds.length === availableFirIds.length
        ? ''
        : serializeSelection(normalizedFirIds),
    mapZoom: '100',
    mapOffsetX: '0',
    mapOffsetY: '0',
  }
}

const autoBackgroundSelectionLimit = 4
const favoriteBackgroundsStorageKey = 'banner-generator-favorite-backgrounds'
const maxFavoriteBackgrounds = 12
const defaultAircraftPhotoLayout: AircraftPhotoLayout = {
  size: '118% auto',
  positionX: '68%',
  positionY: '46%',
}

function getAircraftPhotoLayout(width: number, height: number): AircraftPhotoLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return defaultAircraftPhotoLayout
  }

  const aspectRatio = width / height

  if (aspectRatio >= 1.9) {
    return {
      size: 'auto 146%',
      positionX: '64%',
      positionY: '54%',
    }
  }

  if (aspectRatio >= 1.55) {
    return {
      size: 'auto 140%',
      positionX: '65%',
      positionY: '52%',
    }
  }

  if (aspectRatio >= 1.2) {
    return {
      size: 'auto 132%',
      positionX: '62%',
      positionY: '50%',
    }
  }

  return {
    size: '118% auto',
    positionX: '56%',
    positionY: '42%',
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatPercent(value: number) {
  return `${Number(value.toFixed(2)).toString()}%`
}

function scaleAircraftPhotoSize(size: string, zoomPercent: number) {
  const factor = clampNumber(zoomPercent, 60, 180) / 100
  const match = size.match(/^(auto|\d+(?:\.\d+)?%)\s+(auto|\d+(?:\.\d+)?%)$/)

  if (!match) {
    return size
  }

  const scaleToken = (token: string) => token === 'auto' ? token : formatPercent(parseFloat(token) * factor)

  return `${scaleToken(match[1])} ${scaleToken(match[2])}`
}

function buildAircraftPhotoLayout(
  baseLayout: AircraftPhotoLayout,
  offsetX: number,
  offsetY: number,
  zoomPercent: number,
): AircraftPhotoLayout {
  return {
    size: scaleAircraftPhotoSize(baseLayout.size, zoomPercent),
    positionX: `calc(${baseLayout.positionX} + ${formatPercent(offsetX)})`,
    positionY: `calc(${baseLayout.positionY} + ${formatPercent(offsetY)})`,
  }
}

const tourMapViewBox = {
  width: 1180,
  height: 620,
}

const tourMapMountainRanges: TourMapMountainRange[] = ((tourMapMountainRangesJson as unknown) as TourMapMountainRange[]).filter((range): range is TourMapMountainRange => {
  return (
    typeof range.key === 'string'
    && typeof range.path === 'string'
    && range.path.length > 0
    && typeof range.area === 'number'
    && Number.isFinite(range.area)
    && typeof range.bounds?.minX === 'number'
    && typeof range.bounds?.minY === 'number'
    && typeof range.bounds?.maxX === 'number'
    && typeof range.bounds?.maxY === 'number'
  )
})

const tourMapLakes: TourMapLake[] = ((tourMapLakesJson as unknown) as TourMapLake[]).filter((lake): lake is TourMapLake => {
  return (
    typeof lake.key === 'string'
    && typeof lake.path === 'string'
    && lake.path.length > 0
    && typeof lake.area === 'number'
    && Number.isFinite(lake.area)
    && typeof lake.bounds?.minX === 'number'
    && typeof lake.bounds?.minY === 'number'
    && typeof lake.bounds?.maxX === 'number'
    && typeof lake.bounds?.maxY === 'number'
  )
})

const tourMapRivers: TourMapRiver[] = ((tourMapRiversJson as unknown) as TourMapRiver[]).filter((river): river is TourMapRiver => {
  return (
    typeof river.key === 'string'
    && typeof river.path === 'string'
    && river.path.length > 0
    && typeof river.scaleRank === 'number'
    && Number.isFinite(river.scaleRank)
    && typeof river.bounds?.minX === 'number'
    && typeof river.bounds?.minY === 'number'
    && typeof river.bounds?.maxX === 'number'
    && typeof river.bounds?.maxY === 'number'
  )
})

const tourMapSteppeRegions: TourMapSteppeRegion[] = ((tourMapSteppeJson as unknown) as TourMapSteppeRegion[]).filter((region): region is TourMapSteppeRegion => {
  return (
    typeof region.key === 'string'
    && typeof region.path === 'string'
    && region.path.length > 0
    && typeof region.area === 'number'
    && Number.isFinite(region.area)
    && typeof region.bounds?.minX === 'number'
    && typeof region.bounds?.minY === 'number'
    && typeof region.bounds?.maxX === 'number'
    && typeof region.bounds?.maxY === 'number'
  )
})

const tourMapLandFeature = feature(
  worldLandAtlas as any,
  (worldLandAtlas as any).objects.land,
)
const tourMapProjection = geoNaturalEarth1().fitExtent(
  [
    [42, 34],
    [tourMapViewBox.width - 42, tourMapViewBox.height - 34],
  ],
  tourMapLandFeature,
)
const tourMapPath = geoPath(tourMapProjection)
const tourMapLandPath = tourMapPath(tourMapLandFeature) ?? ''
const tourMapGraticulePath = tourMapPath(geoGraticule10()) ?? ''
const vatsimBoundaryLabelCoordinateOverrides: Partial<Record<string, GeoJsonPosition>> = {
  UBBA: [47.75, 40.5],
  UDDD: [44.397887, 40.148941],
}
const vatsimBoundaryLabelScreenOffsets: Partial<Record<string, { dx: number; dy: number }>> = {
  UBBA: { dx: -28, dy: -10 },
}
const vatsimBoundaryLabelFinalAdjustments: Partial<Record<string, { dx: number; dy: number }>> = {}

const vatspyTopLevelBoundaryOverlays: TourMapRegionOverlay[] = vatspyTopLevelBoundaryFeatures
  .map((feature) => buildVatsimBoundaryOverlay(feature))
  .filter((region): region is TourMapRegionOverlay => region !== null)

const vatspyTopLevelBoundaryOverlayById = new Map(
  vatspyTopLevelBoundaryOverlays.map((region) => [region.label, region] as const),
)

const simawareRegionalBoundaryOverlays: TourMapRegionOverlay[] = (((simawareRegionalBoundariesJson as unknown) as SimawareBoundaryCollection).features ?? [])
  .map((record) => buildSimawareBoundaryOverlay(record))
  .filter((region): region is TourMapRegionOverlay => region !== null)

const ICAO_PREFIX_TO_COUNTRY: Record<string, string> = {
  // Russia
  UU: 'RU', UL: 'RU', US: 'RU', UR: 'RU', UW: 'RU',
  UI: 'RU', UO: 'RU', UH: 'RU', UE: 'RU', UB: 'AZ',
  // Former Soviet Union
  UC: 'KG', UD: 'AM', UG: 'GE', UK: 'UA', UM: 'BY',
  UA: 'KZ', UN: 'KZ', UT: 'TM',
  // Northern Europe
  EG: 'GB', EK: 'DK', EF: 'FI', EE: 'EE',
  EV: 'LV', EY: 'LT', EB: 'BE', EH: 'NL',
  EI: 'IE', EP: 'PL', ED: 'DE', EN: 'NO', ES: 'SE',
  // Southern / Central Europe
  LK: 'CZ', LF: 'FR', LI: 'IT', LS: 'CH',
  LD: 'HR', LJ: 'SI', LO: 'AT', LP: 'PT',
  LR: 'RO', LH: 'HU', LB: 'BG', LG: 'GR',
  LT: 'TR', LY: 'RS', LZ: 'SK', LQ: 'BA',
  LW: 'MK', LN: 'MC', LM: 'MT', LU: 'MD', LA: 'AL',
  // Middle East
  OI: 'IR', OJ: 'JO', OK: 'KW', OL: 'LB', OM: 'AE',
  OO: 'SA', OP: 'PK', OR: 'IQ', OS: 'SY', OT: 'QA',
  OB: 'BH', OE: 'SA', OG: 'IR', OF: 'IR',
  // South / Southeast Asia
  VA: 'IN', VB: 'MM', VC: 'LK', VD: 'KH', VE: 'IN',
  VG: 'BD', VI: 'IN', VL: 'LA', VN: 'NP', VO: 'IN',
  VR: 'MV', VT: 'IN', VV: 'VN', VY: 'MM',
  WI: 'ID', WA: 'ID', WB: 'MY', WM: 'MY', WP: 'TL',
  RK: 'KR', RJ: 'JP', RC: 'TW', RP: 'PH', VH: 'SG',
  VW: 'IN',
  // China
  ZB: 'CN', ZG: 'CN', ZH: 'CN', ZJ: 'CN', ZL: 'CN',
  ZP: 'CN', ZS: 'CN', ZU: 'CN', ZW: 'CN', ZY: 'CN',
  // Africa
  FA: 'ZA', FB: 'BW', FC: 'CG', FD: 'SZ', FE: 'CF',
  FG: 'GQ', FH: 'SH', FI: 'IO', FJ: 'IO', FK: 'CM',
  FL: 'ZM', FM: 'MG', FN: 'AO', FO: 'GA', FP: 'ST',
  FQ: 'MZ', FS: 'SC', FT: 'TD', FV: 'ZW', FW: 'MW',
  FX: 'LS', FY: 'NA', FZ: 'CD',
  HA: 'ET', HB: 'ER', HC: 'SO', HD: 'DJ', HE: 'EG',
  HH: 'ER', HK: 'KE', HL: 'LY', HR: 'RW', HS: 'SD',
  HT: 'TZ', HU: 'UG',
  DB: 'BJ', DF: 'BF', DG: 'GH', DI: 'CI', DN: 'NG',
  DR: 'NE', DS: 'SN', DT: 'TN', DX: 'TG',
  GB: 'GM', GF: 'SL', GG: 'GN', GL: 'LR', GM: 'MA',
  GO: 'SN', GQ: 'MR', GS: 'SN', GU: 'GN', GV: 'CV',
  // Americas (C=Canada, M=Central America, S=South America, T=Caribbean)
  CY: 'CA', CZ: 'CA', CW: 'CA', CF: 'CA', CG: 'CA',
  MH: 'HN', MK: 'MX', ML: 'MX', MM: 'MX', MN: 'NI',
  MP: 'PA', MR: 'CR', MS: 'SV', MT: 'HT', MU: 'CU',
  MW: 'KY', MY: 'BS', MZ: 'BZ',
  SA: 'AR', SB: 'BR', SC: 'CL', SK: 'CO', SL: 'BO',
  SM: 'SR', SP: 'PE', SY: 'GY',
  TJ: 'PR', TN: 'AN', TT: 'TT', TU: 'TT', TV: 'TV',
  // Australia / Oceania
  NF: 'FJ', NG: 'KI', NI: 'NU', NK: 'CK', NL: 'WF',
  NS: 'WS', NT: 'TO', NW: 'NC', NZ: 'NZ',
  AG: 'SB', AN: 'NR', AY: 'PG',
}

const airportCoordinateLookup = createAirportCoordinateLookup(airportsData as AirportCoordinateRecord[])
const airportCountryCodeLookup = createAirportCountryCodeLookup(airportsData as AirportCoordinateRecord[])
const airportCatalog = createAirportCatalog(airportsData as AirportCoordinateRecord[])
const airportByIcaoLookup = createAirportByIcaoLookup(airportCatalog)

function NordwindVirtualLogo({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="built-in-logo is-nordwind" aria-label={ariaLabel}>
      <svg className="built-in-logo-svg" viewBox="0 0 1823 416" aria-hidden="true">
        <path d="M25 280L145 51H500L621 280H378L283 102L173 280H25Z" fill="#ff1018" />
        <path d="M475 280L694 51H977L774 280H475Z" fill="#ff1018" />
        <text
          x="1006"
          y="252"
          fill="#ffffff"
          fontFamily="Manrope, 'Segoe UI', sans-serif"
          fontSize="206"
          fontWeight="300"
          letterSpacing="-8"
        >
          v
        </text>
        <text
          x="1132"
          y="252"
          fill="#ffffff"
          fontFamily="Manrope, 'Segoe UI', sans-serif"
          fontSize="286"
          fontWeight="300"
          letterSpacing="-10"
        >
          NWS
        </text>
        <text
          x="28"
          y="380"
          fill="#ffffff"
          fontFamily="Manrope, 'Segoe UI', sans-serif"
          fontSize="88"
          fontWeight="400"
          letterSpacing="20"
          opacity="0.98"
        >
          Nordwind Virtual Group
        </text>
      </svg>
    </div>
  )
}

function RussianAirwaysGroupLogo({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="built-in-logo is-rag" aria-label={ariaLabel}>
      <img className="built-in-logo-svg" src={ragLogoAsset} alt="" aria-hidden="true" />
    </div>
  )
}

function ProjectLogo({ brandKey, ariaLabel }: { brandKey: BrandKey; ariaLabel: string }) {
  if (brandKey === 'rag') {
    return <RussianAirwaysGroupLogo ariaLabel={ariaLabel} />
  }

  return <NordwindVirtualLogo ariaLabel={ariaLabel} />
}

function DualProjectLogo({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div className="banner-dual-logo-cluster" aria-label={ariaLabel}>
      <div className="banner-dual-logo-item is-vnws">
        <NordwindVirtualLogo ariaLabel="vNWS" />
      </div>
      <div className="banner-dual-logo-item is-rag">
        <RussianAirwaysGroupLogo ariaLabel="RAG" />
      </div>
    </div>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.47 2.92a1.2 1.2 0 0 1 2.06 0l.86 1.47c.2.34.59.54.98.5l1.7-.17a1.2 1.2 0 0 1 1.46 1.45l-.18 1.71a1.2 1.2 0 0 0 .5.98l1.47.86a1.2 1.2 0 0 1 0 2.06l-1.47.86a1.2 1.2 0 0 0-.5.98l.18 1.71a1.2 1.2 0 0 1-1.46 1.45l-1.7-.17a1.2 1.2 0 0 0-.98.5l-.86 1.47a1.2 1.2 0 0 1-2.06 0l-.86-1.47a1.2 1.2 0 0 0-.98-.5l-1.7.17a1.2 1.2 0 0 1-1.46-1.45l.18-1.71a1.2 1.2 0 0 0-.5-.98l-1.47-.86a1.2 1.2 0 0 1 0-2.06l1.47-.86a1.2 1.2 0 0 0 .5-.98l-.18-1.71A1.2 1.2 0 0 1 7.93 4.72l1.7.17a1.2 1.2 0 0 0 .98-.5l.86-1.47Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3.2" fill="rgba(11,16,24,0.92)" />
    </svg>
  )
}

function splitHeadline(city: string) {
  const normalizedCity = city.trim()

  if (!normalizedCity) {
    return ['City']
  }

  const words = normalizedCity.split(/\s+/)

  if (words.length === 1) {
    return words
  }

  if (words.length === 2) {
    return [words[0], words[1]]
  }

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function renderBadgeIcon(icon: BadgeIcon) {
  switch (icon) {
    case 'star':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2.8 2.87 5.82 6.43.94-4.65 4.53 1.1 6.4L12 17.46 6.25 20.5l1.1-6.4L2.7 9.56l6.43-.94L12 2.8Z" fill="currentColor" />
        </svg>
      )
    case 'aircraft':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.4 11.2 13 8.7 9.1 2.5 7.2 3l1.3 6.4-4.3-1.2-1.8-2.7-1.4.4L2 10l-1.1 4 1.4.4 1.8-2.7 4.3-1.2L7.2 17l1.9.5 3.9-6.2 8.4-2.5v-1.6Z" fill="currentColor" />
        </svg>
      )
    case 'jet':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 10.2-7.7-2.4L10.1 3h-1l.8 5.1-3.6-1.1-1.7-2.2-.9.3.8 3.5-2.8.9v1l2.8.9-.8 3.5.9.3 1.7-2.2 3.6-1.1-.8 5.1h1l3.2-4.8L21 13.8v-3.6Z" fill="currentColor" />
        </svg>
      )
    case 'airliner':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 13.5h18v-3H3v3Zm2.8-4.2 2.1-2.9h8.2l2.1 2.9H5.8Zm2.5 5.8 1.4 2.1h4.6l1.4-2.1H8.3Z" fill="currentColor" />
        </svg>
      )
    case 'prop':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 10.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Zm-.8-8.1c1.5.6 2.6 1.8 3 3.4.5 1.8-.8 3.3-2.2 5m9.1 1.7c-.6 1.5-1.8 2.6-3.4 3-1.8.5-3.3-.8-5-2.2m-.8 8.6c-1.5-.6-2.6-1.8-3-3.4-.5-1.8.8-3.3 2.2-5m-8.6-.8c.6-1.5 1.8-2.6 3.4-3 1.8-.5 3.3.8 5 2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'helicopter':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 7.2h19m-10.4 0V4.8m-4.1 8.1h7.8c2.4 0 3.7 1.3 3.7 3v1.4H9.6l-2.1 1.9H5.6l1.6-1.9H4.8c-.8 0-1.4-.6-1.4-1.4v-.5c0-1.4 1.5-2.5 3.6-2.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'route':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5.2 17.8a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Zm13.6-8.4a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2ZM7.6 15.1c3-5.9 7.5-7 8.9-7.1m-7.6 9.2c4.1-.3 7.2 1.1 9.2 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'globe':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-6.7-5.5h13.4M5.3 8.5h13.4M12 3.4c2.2 2.1 3.5 5.2 3.5 8.6 0 3.4-1.3 6.5-3.5 8.6m0-17.2C9.8 5.5 8.5 8.6 8.5 12c0 3.4 1.3 6.5 3.5 8.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'crown':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 18 1.5-10 5.1 4.2L12 5l2.4 7.2L19.5 8 21 18H3Z" fill="currentColor" />
        </svg>
      )
    case 'vatsim':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16l-8 12L4 6Z" fill="currentColor" />
          <path d="M12 3v18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'laurel':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.2 18.5C5.5 16.7 4 13.7 4 10.2c0-1.8.4-3.4 1.2-4.8m10.6 13.1c2.7-1.8 4.2-4.8 4.2-8.3 0-1.8-.4-3.4-1.2-4.8M9 8.2c-1.4.8-2.2 2.1-2.2 3.7 0 1.4.7 2.7 2 3.5m6.2-7.2c1.4.8 2.2 2.1 2.2 3.7 0 1.4-.7 2.7-2 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'medal':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8 2 4 5 4-5h2l-4.1 7.2A5.7 5.7 0 1 1 10.1 9.2L6 2h2Z" fill="currentColor" />
        </svg>
      )
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadFavoriteBackgrounds() {
  if (typeof window === 'undefined') {
    return [] as FavoriteBackground[]
  }

  try {
    const rawValue = window.localStorage.getItem(favoriteBackgroundsStorageKey)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.flatMap((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.key !== 'string' ||
        typeof item.label !== 'string' ||
        typeof item.sourceUrl !== 'string' ||
        typeof item.createdAt !== 'number'
      ) {
        return []
      }

      return [item as FavoriteBackground]
    })
  } catch {
    return []
  }
}

function getFlagAssetCode(countryCode: string | null | undefined) {
  const normalizedCountryCode = (countryCode ?? '').trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
    return null
  }

  return normalizedCountryCode.toLowerCase()
}

function getIcaoCountryCode(icao: string): string | null {
  const code = icao.trim().toUpperCase()
  if (code.length < 2) return null
  const exactMatch = airportCountryCodeLookup.get(code)
  if (exactMatch) return exactMatch
  const prefix2 = code.substring(0, 2)
  if (ICAO_PREFIX_TO_COUNTRY[prefix2]) return ICAO_PREFIX_TO_COUNTRY[prefix2]
  const prefix1 = code.charAt(0)
  if (prefix1 === 'K' || prefix1 === 'P') return 'US'
  if (prefix1 === 'Y') return 'AU'
  if (prefix1 === 'Z') return 'CN'
  if (prefix1 === 'C') return 'CA'
  return null
}

function getCountryDisplayName(countryCode: string | undefined) {
  const normalizedCountryCode = (countryCode ?? '').trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
    return ''
  }

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalizedCountryCode) ?? ''
  } catch {
    return ''
  }
}

function cleanWikimediaTitle(title: string) {
  return title
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildCityViewQueries(form: BannerFormState) {
  const city = form.city.trim()
  const countryName = getCountryDisplayName(form.countryCode)
  const withCountryName = countryName ? ` ${countryName}` : ''

  return Array.from(
    new Set(
      [
        city ? `${city} skyline${withCountryName}` : '',
        city ? `${city} panorama${withCountryName}` : '',
        city ? `${city} cityscape${withCountryName}` : '',
        city ? `${city} aerial view${withCountryName}` : '',
        city ? `${city} waterfront${withCountryName}` : '',
        city ? `${city} downtown${withCountryName}` : '',
        city ? `${city} landmark${withCountryName}` : '',
        city ? `${city} historic center${withCountryName}` : '',
        city ? `${city} night view${withCountryName}` : '',
      ].filter(Boolean),
    ),
  )
}

function normalizeWikimediaCategoryTitle(value: string) {
  return value
    .replace(/^category:/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getWikimediaCandidateMetadataText(candidate: WikimediaCandidate) {
  const categoryText = candidate.categories
    .map(normalizeWikimediaCategoryTitle)
    .filter(Boolean)
    .join(' ')

  return `${candidate.title.toLowerCase()} ${categoryText}`.trim()
}

function buildAirportFallbackQueries(form: BannerFormState, brandKey: BrandKey) {
  const city = form.city.trim()
  const airportName = form.airportName.trim()
  const icao = form.icao.trim().toUpperCase()
  const countryName = getCountryDisplayName(form.countryCode)
  const withCountryName = countryName ? ` ${countryName}` : ''

  const queries: string[] = []

  if (brandKey === 'nordwind') {
    if (icao) queries.push(`Nordwind Airlines ${icao}`)
    if (city) queries.push(`Nordwind Airlines ${city}`)
  }

  if (airportName && city) queries.push(`${airportName} airport ${city}${withCountryName}`)
  if (airportName) queries.push(`${airportName} airport${withCountryName}`)

  return Array.from(new Set(queries.filter(Boolean)))
}

function getSearchTerms(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 2),
    ),
  )
}

function scoreWikimediaCandidate(
  candidate: WikimediaCandidate,
  searchTerms: string[],
  mode: 'city-view' | 'airport-fallback',
) {
  const metadataText = getWikimediaCandidateMetadataText(candidate)
  const scenicTokens = /(skyline|panorama|cityscape|aerial|waterfront|riverfront|river|embankment|downtown|historic|old town|city centre|city center|harbour|harbor|bay|coast|coastline|seafront|promenade|boulevard|night|dusk|sunset|sunrise|bridge|square|viewpoint|bird(?:'|’)s-eye view|birds-eye view)/i
  const landmarkTokens = /(landmark|cathedral|church|palace|tower|monument|bridge|fortress|kremlin|castle|architecture|basilica|spire|dome|mosque|temple|synagogue|facade|exterior)/i
  const indoorTokens = /(interior|inside|indoor|lobby|atrium|corridor|passage|concourse|waiting area|check-?in|security|baggage claim|duty free|restaurant|cafe|mall|museum interior|gallery interior|exhibition hall|terminal interior|departure hall|arrival hall|boarding gate|gate area|platform level|metro station interior|subway station interior|office interior|hotel room|conference hall|auditorium|ceiling|escalator|staircase)/i
  const transitTokens = /(tram|trolleybus|bus|train|locomotive|railway station|metro station|subway station|platform|depot)/i
  const noisyUrbanTokens = /(residential|apartment|housing estate|housing|district|microdistrict|quarter|office block|business center|business centre|shopping center|shopping centre|complex|street|avenue|road|highway|parking|car park|car|cars|traffic|people|crowd|festival|concert|fair|market|event venue|installation|construction|warehouse)/i
  const cityViewAnchorTokens = new RegExp(`${scenicTokens.source}|${landmarkTokens.source}`, 'i')

  // Hard reject: maps, flags, diagrams, transit
  if (/(map|flag|locator|logo|diagram|route|coat|arms|emblem|schema|plan|chart|poster|drawing|illustration|render|ticket|timetable)/i.test(metadataText)) {
    return -1000
  }

  if (indoorTokens.test(metadataText)) {
    return -1000
  }

  // Hard reject airport and aircraft-related content for city-view
  if (mode === 'city-view' && /(airport|terminal building|runway|airfield|apron|taxiway|boeing|airbus|aircraft|plane|airliner|landing|takeoff|pobeda|aeroflot|rossiya|nordwind|hangar|baggage)/i.test(metadataText)) {
    return -1000
  }

  if (mode === 'city-view' && transitTokens.test(metadataText) && !cityViewAnchorTokens.test(metadataText)) {
    return -1000
  }

  if (mode === 'city-view' && noisyUrbanTokens.test(metadataText) && !cityViewAnchorTokens.test(metadataText)) {
    return -1000
  }

  let score = 0

  const ratio = candidate.width > 0 && candidate.height > 0 ? candidate.width / candidate.height : 16 / 9
  score -= Math.abs(ratio - 16 / 9) * 40

  if (candidate.width >= 1600) score += 18
  if (candidate.width >= 2200) score += 12
  if (candidate.width > 0 && candidate.height > 0 && candidate.width < candidate.height) score -= 28

  // City landmarks, skylines, and scenic outdoor views
  if (new RegExp(`${scenicTokens.source}|view`, 'i').test(metadataText)) {
    score += mode === 'city-view' ? 34 : 16
  }

  // Landmarks, historic buildings — strong city-view bonus
  if (landmarkTokens.test(metadataText)) {
    score += mode === 'city-view' ? 28 : 8
  }

  // Night/evening shots get a boost
  if (/(night|evening|dusk|sunset|sunrise|illuminat|lit)/i.test(metadataText)) {
    score += mode === 'city-view' ? 14 : 4
  }

  // Airport/aircraft bonus only for fallback mode
  if (mode === 'airport-fallback' && /(airport|terminal building|runway|airfield|apron|taxiway|control tower|nordwind|aircraft|airline)/i.test(metadataText)) {
    score += 14
  }

  if (mode === 'city-view' && noisyUrbanTokens.test(metadataText)) {
    score -= 26
  }

  if (mode === 'city-view' && /\b\d{4}\b/.test(metadataText) && !cityViewAnchorTokens.test(metadataText)) {
    score -= 12
  }

  if (mode === 'city-view' && !cityViewAnchorTokens.test(metadataText)) {
    score -= 18
  }

  for (const term of searchTerms) {
    if (metadataText.includes(term)) {
      score += mode === 'city-view' ? 10 : 7
    }
  }

  return score
}

async function searchWikimediaCommons(query: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '15',
    prop: 'imageinfo|categories',
    cllimit: '20',
    clshow: '!hidden',
    iiprop: 'url|size',
    iiurlwidth: '1920',
    format: 'json',
    origin: '*',
  })

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error('Wikimedia search request failed')
  }

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string
          categories?: Array<{
            title?: string
          }>
          imageinfo?: Array<{
            thumburl?: string
            url?: string
            thumbwidth?: number
            thumbheight?: number
            width?: number
            height?: number
          }>
        }
      >
    }
  }

  return Object.values(data.query?.pages ?? {}).flatMap((page) => {
    const info = page.imageinfo?.[0]

    if (!info) {
      return []
    }

    const thumbUrl = info.thumburl ?? info.url

    if (!thumbUrl) {
      return []
    }

    return [
      {
        title: page.title,
        thumbUrl,
        width: info.thumbwidth ?? info.width ?? 0,
        height: info.thumbheight ?? info.height ?? 0,
        categories: (page.categories ?? [])
          .map((category) => category.title?.trim() ?? '')
          .filter(Boolean),
      },
    ]
  })
}

async function fetchAutoBackgroundCandidates(form: BannerFormState, brandKey: BrandKey, signal: AbortSignal) {
  const cityViewQueries = buildCityViewQueries(form)
  const airportFallbackQueries = buildAirportFallbackQueries(form, brandKey)
  const citySearchTerms = getSearchTerms(`${form.city} ${getCountryDisplayName(form.countryCode)}`)
  const airportSearchTerms = getSearchTerms(`${form.airportName} ${form.city}`)
  const candidateMap = new Map<
    string,
    WikimediaCandidate & {
      score: number
    }
  >()

  async function collectCandidates(
    queries: string[],
    searchTerms: string[],
    mode: 'city-view' | 'airport-fallback',
  ) {
    for (const query of queries) {
      const candidates = await searchWikimediaCommons(query, signal)

      for (const candidate of candidates) {
        const score = scoreWikimediaCandidate(candidate, searchTerms, mode)

        if (score <= -40) {
          continue
        }

        const key = candidate.title.toLowerCase()
        const existingCandidate = candidateMap.get(key)

        if (!existingCandidate || score > existingCandidate.score) {
          candidateMap.set(key, {
            ...candidate,
            score,
          })
        }
      }
    }
  }

  await collectCandidates(cityViewQueries, citySearchTerms, 'city-view')

  if (candidateMap.size < autoBackgroundSelectionLimit) {
    await collectCandidates(airportFallbackQueries, airportSearchTerms, 'airport-fallback')
  }

  const sortedCandidates = [...candidateMap.values()].sort((left, right) => right.score - left.score)

  return sortedCandidates.slice(0, autoBackgroundSelectionLimit)
}

function getAircraftSourceLabel(source: string) {
  if (source.toLowerCase() === 'vnws') {
    return 'vNWS'
  }

  if (source.toLowerCase() === 'rag') {
    return 'RAG'
  }

  return source.toUpperCase()
}

function getAircraftTypeLabel(aircraft: AircraftCatalogItem) {
  return aircraft.fleet_code?.trim().toUpperCase() || aircraft.fleet_name?.trim() || aircraft.fleet_type?.trim().toUpperCase() || ''
}

function getAircraftDisplayTypeLabel(aircraft: AircraftCatalogItem) {
  return aircraft.fleet_name?.trim() || getAircraftTypeLabel(aircraft) || aircraft.name.trim()
}

function getAircraftAirlineLabel(aircraft: AircraftCatalogItem) {
  const airlineCodeSource = [
    aircraft.fleet_name?.trim() ?? '',
    aircraft.name?.trim() ?? '',
  ].find((value) => /\(([^)]+)\)\s*$/.test(value)) ?? ''
  const bracketMatch = airlineCodeSource.match(/\(([^)]+)\)\s*$/)
  const airlineCode = bracketMatch?.[1]?.trim().toUpperCase()
  const fleetName = aircraft.fleet_name?.trim().toLowerCase() ?? ''
  const aircraftName = aircraft.name?.trim().toLowerCase() ?? ''
  const fleetCode = aircraft.fleet_code?.trim().toUpperCase() ?? ''

  if (airlineCode) {
    return aircraftAirlineCodeLabels[airlineCode] ?? airlineCode
  }

  if (aircraft.source.toLowerCase() === 'vnws') {
    if (
      fleetCode === 'E190'
      || fleetName.includes('embraer')
      || fleetName.includes('erj-190')
      || aircraftName.includes('embraer')
    ) {
      return 'IKAR'
    }
    return 'Nordwind Airlines'
  }

  if (aircraft.source.toLowerCase() === 'rag') {
    return 'RAG Fleet'
  }

  return getAircraftSourceLabel(aircraft.source)
}

function toLocalAircraftPhotoOption(option: AircraftCatalogItem | null | undefined): AircraftPhotoOption | null {
  if (!option?.image_url) {
    return null
  }

  return {
    provider: 'vamsys',
    image_url: option.image_url,
    thumbnail_url: option.image_url,
    attribution: option.image_attribution,
    linkback: option.image_linkback,
  }
}

async function fetchAircraftCatalog(query: string, sources: AircraftSource[], signal: AbortSignal, limit: number) {
  const apiBaseUrl = getApiBaseUrl()
  const params = new URLSearchParams()

  if (query.trim()) {
    params.set('query', query.trim())
  }

  params.set('limit', String(limit))

  for (const source of sources) {
    params.append('sources', source)
  }

  const response = await fetch(`${apiBaseUrl}/aircraft?${params.toString()}`, { signal })

  if (!response.ok) {
    throw new Error('Aircraft catalog request failed')
  }

  const payload = (await response.json()) as {
    items?: AircraftCatalogItem[]
  }

  return payload.items ?? []
}

function getBundledAircraftCatalog(source: AircraftSource, query: string, limit: number) {
  const queryNormalized = query.trim().toLowerCase()
  const items = bundledAircraftCatalogBySource[source] ?? []

  const filteredItems = queryNormalized
    ? items.filter((record) => (
      record.registration.toLowerCase().includes(queryNormalized) ||
      record.name.toLowerCase().includes(queryNormalized) ||
      (record.fleet_name ? record.fleet_name.toLowerCase().includes(queryNormalized) : false) ||
      (record.fleet_code ? record.fleet_code.toLowerCase().includes(queryNormalized) : false) ||
      (record.fleet_type ? record.fleet_type.toLowerCase().includes(queryNormalized) : false) ||
      record.tags.some((tag) => tag.toLowerCase().includes(queryNormalized))
    ))
    : items

  return filteredItems.slice(0, limit)
}

async function syncAircraftCatalog(source: string) {
  const apiBaseUrl = getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/aircraft/sync/${source}?limit=5000`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Aircraft sync request failed')
  }
}

async function syncAircraftCatalogs(sources: AircraftSource[]) {
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      await syncAircraftCatalog(source)
      return source
    }),
  )
  const failedResult = results.find((result) => result.status === 'rejected')

  if (failedResult) {
    throw failedResult.reason
  }

  return results.map((result, index) => ({
    source: sources[index],
    ok: result.status === 'fulfilled',
  }))
}

async function fetchAircraftPhotoOptions(registration: string, source?: string, aircraftId?: string) {
  const apiBaseUrl = getApiBaseUrl()
  const params = new URLSearchParams({
    limit: '6',
  })
  params.set('_ts', String(Date.now()))

  if (source) {
    params.set('source', source)
  }

  if (aircraftId) {
    params.set('aircraft_id', aircraftId)
  }

  const response = await fetch(`${apiBaseUrl}/aircraft/photos/${encodeURIComponent(registration)}?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Aircraft photo request failed')
  }

  const payload = (await response.json()) as {
    items?: AircraftPhotoOption[]
  }

  return payload.items ?? []
}

async function fetchAircraftPhotoOptionsByType(query: string, source?: string, aircraftId?: string) {
  const apiBaseUrl = getApiBaseUrl()
  const params = new URLSearchParams({
    query,
    limit: '6',
  })
  params.set('_ts', String(Date.now()))

  if (source) {
    params.set('source', source)
  }

  if (aircraftId) {
    params.set('aircraft_id', aircraftId)
  }

  const response = await fetch(`${apiBaseUrl}/aircraft/photos-by-type?${params.toString()}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Aircraft type photo request failed')
  }

  const payload = (await response.json()) as {
    items?: AircraftPhotoOption[]
  }

  return payload.items ?? []
}

function mergeAircraftPhotoOptions(...groups: AircraftPhotoOption[][]) {
  const merged: AircraftPhotoOption[] = []

  for (const group of groups) {
    for (const item of group) {
      if (merged.some((existing) => existing.image_url === item.image_url)) {
        continue
      }

      merged.push(item)
    }
  }

  return merged
}

function getAircraftPhotoSearchSteps(
  eventType: EventType,
  registration: string,
  typeQuery: string,
): Array<'registration' | 'type'> {
  const hasRegistration = Boolean(registration.trim())
  const hasTypeQuery = Boolean(typeQuery.trim())
  const steps: Array<'registration' | 'type'> = []

  if (hasRegistration) {
    steps.push('registration')
  }

  if (hasTypeQuery) {
    steps.push('type')
  }

  if (eventType === 'curated-roster' && hasRegistration && hasTypeQuery) {
    return ['registration', 'type']
  }

  return steps
}

async function loadRegistrationPhotoOptionsWithFallback(
  registration: string,
  source?: AircraftSource,
  aircraftId?: string,
) {
  let photoItems: AircraftPhotoOption[] = []

  try {
    photoItems = await fetchAircraftPhotoOptions(registration, source, aircraftId)
  } catch {
    photoItems = []
  }

  if (photoItems.length === 0 && source && aircraftId) {
    try {
      photoItems = await fetchAircraftPhotoOptions(registration, source)
    } catch {
      photoItems = []
    }
  }

  if (photoItems.length === 0 && source) {
    try {
      photoItems = await fetchAircraftPhotoOptions(registration)
    } catch {
      photoItems = []
    }
  }

  return photoItems
}

async function loadTypePhotoOptionsWithFallback(
  query: string,
  source?: AircraftSource,
  aircraftId?: string,
  displayQuery?: string,
) {
  let photoItems: AircraftPhotoOption[] = []

  try {
    photoItems = await fetchAircraftPhotoOptionsByType(query, source, aircraftId)
  } catch {
    photoItems = []
  }

  if (photoItems.length === 0 && displayQuery && displayQuery !== query) {
    try {
      photoItems = await fetchAircraftPhotoOptionsByType(displayQuery, source, aircraftId)
    } catch {
      photoItems = []
    }
  }

  if (photoItems.length === 0 && source && aircraftId) {
    try {
      photoItems = await fetchAircraftPhotoOptionsByType(query, source)
    } catch {
      photoItems = []
    }
  }

  if (photoItems.length === 0 && displayQuery && displayQuery !== query && source) {
    try {
      photoItems = await fetchAircraftPhotoOptionsByType(displayQuery, source)
    } catch {
      photoItems = []
    }
  }

  if (photoItems.length === 0 && source) {
    try {
      photoItems = await fetchAircraftPhotoOptionsByType(query)
    } catch {
      photoItems = []
    }
  }

  if (photoItems.length === 0 && displayQuery && displayQuery !== query) {
    try {
      photoItems = await fetchAircraftPhotoOptionsByType(displayQuery)
    } catch {
      photoItems = []
    }
  }

  return photoItems
}

async function archiveCreation(payload: {
  eventType: EventType
  brand: string
  title: string
  description: string | null
  imageDataUrl: string
  metadata: Record<string, unknown>
}) {
  const apiBaseUrl = getApiBaseUrl()

  await fetch(`${apiBaseUrl}/creations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: payload.eventType,
      brand: payload.brand,
      title: payload.title,
      description: payload.description,
      image_data_url: payload.imageDataUrl,
      metadata: payload.metadata,
    }),
  })
}

async function storeBannerGeneratorAsset(payload: { imageDataUrl: string; fileName: string }) {
  const response = await fetch('/api/admin/banner-generator/assets', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageDataUrl: payload.imageDataUrl,
      mimeType: 'image/png',
      fileName: payload.fileName,
    }),
  })

  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    asset?: {
      assetUrl?: string
    }
  }

  if (!response.ok || !body?.ok || !body?.asset?.assetUrl) {
    throw new Error(body?.error || 'Failed to save banner asset')
  }

  return body.asset.assetUrl
}

async function fetchCreationArchive() {
  const apiBaseUrl = getApiBaseUrl()
  const response = await fetch(`${apiBaseUrl}/creations`)

  if (!response.ok) {
    throw new Error('Creation archive request failed')
  }

  const payload = (await response.json()) as {
    items?: CreationGalleryItem[]
  }

  return (payload.items ?? []).map((item) => ({
    ...item,
    image_url: item.image_url ? `${apiBaseUrl}${item.image_url}` : null,
  }))
}

function getAutoBackgroundSearchKey(form: BannerFormState, eventType: EventType, brandKey: BrandKey) {
  return [
    eventType,
    brandKey,
    form.city.trim().toLowerCase(),
    form.airportName.trim().toLowerCase(),
    (form.countryCode ?? '').trim().toUpperCase(),
  ].join('|')
}

function isRouteEvent(eventType: EventType): eventType is RouteEventType {
  return eventType === 'tour' || eventType === 'roster' || eventType === 'curated-roster'
}

function isCommunityEvent(eventType: EventType): eventType is CommunityEventType {
  return eventType === 'community-challenge' || eventType === 'community-goal'
}

function getRouteEventFormConfig(eventType: RouteEventType, strings: InterfaceCopy): RouteEventFormConfig {
  if (eventType === 'roster') {
    return {
      titleField: 'rosterTitle',
      legsField: 'rosterLegs',
      descriptionField: 'rosterDescription',
      bonusField: 'rosterBonusPoints',
      registrationField: 'rosterRegistrationRequired',
      titleLabel: strings.rosterTitleLabel,
      titlePlaceholder: strings.rosterTitlePlaceholder,
      descriptionLabel: strings.rosterDescriptionLabel,
      descriptionHelp: strings.rosterDescriptionHelp,
      descriptionPlaceholder: strings.rosterDescriptionPlaceholder,
      previewLabel: strings.rosterPreviewLabel,
      previewEmpty: strings.rosterPreviewEmpty,
    }
  }

  if (eventType === 'curated-roster') {
    return {
      titleField: 'curatedRosterTitle',
      legsField: 'curatedRosterLegs',
      descriptionField: 'curatedRosterDescription',
      bonusField: 'curatedRosterBonusPoints',
      registrationField: 'curatedRosterRegistrationRequired',
      titleLabel: strings.curatedRosterTitleLabel,
      titlePlaceholder: strings.curatedRosterTitlePlaceholder,
      descriptionLabel: strings.curatedRosterDescriptionLabel,
      descriptionHelp: strings.curatedRosterDescriptionHelp,
      descriptionPlaceholder: strings.curatedRosterDescriptionPlaceholder,
      previewLabel: strings.curatedRosterPreviewLabel,
      previewEmpty: strings.curatedRosterPreviewEmpty,
    }
  }

  return {
    titleField: 'tourTitle',
    legsField: 'tourLegs',
    descriptionField: 'tourDescription',
    bonusField: 'tourBonusPoints',
    registrationField: 'tourRegistrationRequired',
    titleLabel: strings.tourTitleLabel,
    titlePlaceholder: strings.tourTitlePlaceholder,
    descriptionLabel: strings.tourDescriptionLabel,
    descriptionHelp: strings.tourDescriptionHelp,
    descriptionPlaceholder: strings.tourDescriptionPlaceholder,
    previewLabel: strings.tourPreviewLabel,
    previewEmpty: strings.tourPreviewEmpty,
  }
}

function getAircraftFieldConfig(eventType: EventType): AircraftFieldConfig | null {
  if (eventType === 'roster') {
    return {
      enabledField: 'rosterAircraftEnabled',
      searchField: 'rosterAircraftSearch',
      sourceField: 'rosterAircraftSource',
      idField: 'rosterAircraftId',
      nameField: 'rosterAircraftName',
      registrationField: 'rosterAircraftRegistration',
      photoUrlField: 'rosterAircraftPhotoUrl',
      photoAttributionField: 'rosterAircraftPhotoAttribution',
      photoLinkbackField: 'rosterAircraftPhotoLinkback',
      photoManualField: 'rosterAircraftPhotoManual',
      photoOffsetXField: 'rosterAircraftPhotoOffsetX',
      photoOffsetYField: 'rosterAircraftPhotoOffsetY',
      photoZoomField: 'rosterAircraftPhotoZoom',
    }
  }

  if (eventType === 'curated-roster') {
    return {
      enabledField: 'curatedRosterAircraftEnabled',
      searchField: 'curatedRosterAircraftSearch',
      sourceField: 'curatedRosterAircraftSource',
      idField: 'curatedRosterAircraftId',
      nameField: 'curatedRosterAircraftName',
      registrationField: 'curatedRosterAircraftRegistration',
      photoUrlField: 'curatedRosterAircraftPhotoUrl',
      photoAttributionField: 'curatedRosterAircraftPhotoAttribution',
      photoLinkbackField: 'curatedRosterAircraftPhotoLinkback',
      photoManualField: 'curatedRosterAircraftPhotoManual',
      photoOffsetXField: 'curatedRosterAircraftPhotoOffsetX',
      photoOffsetYField: 'curatedRosterAircraftPhotoOffsetY',
      photoZoomField: 'curatedRosterAircraftPhotoZoom',
    }
  }

  return null
}

function getEventBonusPointsField(eventType: EventType): BonusField {
  switch (eventType) {
    case 'vatsim-region':
      return 'vatsimRegionBonusPoints'
    case 'tour':
      return 'tourBonusPoints'
    case 'roster':
      return 'rosterBonusPoints'
    case 'curated-roster':
      return 'curatedRosterBonusPoints'
    case 'community-challenge':
      return 'challengeBonusPoints'
    case 'community-goal':
      return 'communityGoalBonusPoints'
    default:
      return 'focusBonusPoints'
  }
}

function getEventRegistrationField(eventType: EventType): RegistrationField {
  switch (eventType) {
    case 'vatsim-region':
      return 'vatsimRegionRegistrationRequired'
    case 'tour':
      return 'tourRegistrationRequired'
    case 'roster':
      return 'rosterRegistrationRequired'
    case 'curated-roster':
      return 'curatedRosterRegistrationRequired'
    case 'community-challenge':
      return 'challengeRegistrationRequired'
    case 'community-goal':
      return 'communityGoalRegistrationRequired'
    default:
      return 'focusRegistrationRequired'
  }
}

function getDisplayedBackgroundName(
  backgroundInfo: BackgroundInfo,
  strings: InterfaceCopy,
  isAutoSelectingBackground: boolean,
  eventType: EventType,
  backgroundMode: 'auto' | 'manual',
) {
  if (backgroundMode === 'auto' && isVatsimRegionEvent(eventType)) {
    return strings.vatsimRegionVisualDisplay
  }

  if (backgroundMode === 'auto' && isComplexEvent(eventType)) {
    return strings.complexEventVisualDisplay
  }

  if (backgroundMode === 'auto' && isRouteEvent(eventType)) {
    return strings.tourAutoVisualDisplay
  }

  if (backgroundMode === 'auto' && isCommunityEvent(eventType)) {
    return strings.communityAutoVisualDisplay
  }

  if (isAutoSelectingBackground) {
    return strings.autoBackgroundLoadingLabel
  }

  switch (backgroundInfo.kind) {
    case 'auto':
      return `${strings.autoBackgroundDisplayPrefix}${backgroundInfo.label}`
    case 'manual':
      return backgroundInfo.label
    case 'auto-empty':
      return strings.autoBackgroundEmptyLabel
    case 'auto-error':
      return strings.autoBackgroundErrorLabel
    case 'fallback':
    default:
      return strings.defaultBackgroundDisplay
  }
}

function getVisualSectionCopy(eventType: EventType, strings: InterfaceCopy) {
  if (isVatsimRegionEvent(eventType)) {
    return {
      label: strings.vatsimRegionVisualLabel,
      help: strings.vatsimRegionVisualHelp,
    }
  }

  if (isComplexEvent(eventType)) {
    return {
      label: strings.complexEventVisualLabel,
      help: strings.complexEventVisualHelp,
    }
  }

  if (isRouteEvent(eventType)) {
    return {
      label: strings.tourVisualLabel,
      help: strings.tourVisualHelp,
    }
  }

  if (isCommunityEvent(eventType)) {
    return {
      label: strings.communityVisualLabel,
      help: strings.communityVisualHelp,
    }
  }

  return {
    label: strings.cityPhotoLabel,
    help: strings.cityPhotoHelp,
  }
}

function getEventName(eventType: EventType, strings: InterfaceCopy) {
  if (eventType === 'vatsim-region') {
    return strings.vatsimRegionEventName
  }

  if (eventType === 'event') {
    return strings.complexEventEventName
  }

  if (eventType === 'tour') {
    return strings.tourEventName
  }

  if (eventType === 'roster') {
    return strings.rosterEventName
  }

  if (eventType === 'curated-roster') {
    return strings.curatedRosterEventName
  }

  if (eventType === 'community-challenge') {
    return strings.communityChallengeEventName
  }

  if (eventType === 'community-goal') {
    return strings.communityGoalEventName
  }

  return strings.focusAirportEventName
}

function parseTourLegs(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((leg) => leg.trim())
    .filter(Boolean)
    .map((leg) => leg.replace(/\s*(?:->|→|[-–—])\s*/g, ' - ').replace(/\s+/g, ' ').toUpperCase())
}

function parseTourLegPairs(value: string) {
  return parseTourLegs(value).flatMap((leg) => {
    const [from, to] = leg.split(' - ').map((segment) => segment.trim())

    if (!from || !to) {
      return []
    }

    return [
      {
        from,
        to,
      },
    ]
  })
}

function getTourStops(legs: TourLegPair[]) {
  const stops: string[] = []

  for (const leg of legs) {
    if (stops[stops.length - 1] !== leg.from) {
      stops.push(leg.from)
    }

    if (stops[stops.length - 1] !== leg.to) {
      stops.push(leg.to)
    }
  }

  return stops
}

function createAirportCoordinateLookup(records: AirportCoordinateRecord[]) {
  const lookup = new Map<string, AirportCoordinate>()

  for (const record of records) {
    if (typeof record.latitude !== 'number' || typeof record.longitude !== 'number') {
      continue
    }

    const coordinate = {
      latitude: record.latitude,
      longitude: record.longitude,
    }
    const normalizedIcao = record.icao?.trim().toUpperCase()
    const normalizedIata = record.iata?.trim().toUpperCase()

    if (normalizedIcao && !lookup.has(normalizedIcao)) {
      lookup.set(normalizedIcao, coordinate)
    }

    if (normalizedIata && !lookup.has(normalizedIata)) {
      lookup.set(normalizedIata, coordinate)
    }
  }

  return lookup
}

function createAirportCountryCodeLookup(records: AirportCoordinateRecord[]) {
  const lookup = new Map<string, string>()

  for (const record of records) {
    const normalizedIcao = record.icao?.trim().toUpperCase()
    const normalizedIata = record.iata?.trim().toUpperCase()
    const country = record.country?.trim()

    if (!country) {
      continue
    }

    const alpha2 = countries.getAlpha2Code(country, 'en')

    if (!alpha2) {
      continue
    }

    const normalizedCountryCode = alpha2.toUpperCase()

    if (normalizedIcao && !lookup.has(normalizedIcao)) {
      lookup.set(normalizedIcao, normalizedCountryCode)
    }

    if (normalizedIata && !lookup.has(normalizedIata)) {
      lookup.set(normalizedIata, normalizedCountryCode)
    }
  }

  return lookup
}

function createAirportCatalog(records: AirportCoordinateRecord[]) {
  return records.flatMap((record) => {
    const icao = record.icao?.trim().toUpperCase()
    const name = record.name?.trim()
    const city = record.city?.trim()

    if (!icao || !name || !city) {
      return []
    }

    return [
      {
        name,
        city,
        countryCode: getCountryCodeFromAirportRecord(record),
        iata: record.iata?.trim().toUpperCase() || null,
        icao,
        type: record.type?.trim() || null,
      },
    ]
  })
}

function createAirportByIcaoLookup(airports: AirportCatalogOption[]) {
  const lookup = new Map<string, AirportCatalogOption>()

  for (const airport of airports) {
    if (!lookup.has(airport.icao)) {
      lookup.set(airport.icao, airport)
    }

    if (airport.iata && !lookup.has(airport.iata)) {
      lookup.set(airport.iata, airport)
    }
  }

  return lookup
}

function getCountryCodeFromAirportRecord(record: AirportCoordinateRecord) {
  const country = record.country?.trim()

  if (country) {
    const alpha2 = countries.getAlpha2Code(country, 'en')

    if (alpha2) {
      return alpha2.toUpperCase()
    }
  }

  const codeFromIcao = record.icao ? getIcaoCountryCode(record.icao) : null

  if (codeFromIcao) {
    return codeFromIcao
  }

  return ''
}

function applyAirportOptionToForm(option: AirportCatalogOption) {
  return {
    city: option.city,
    countryCode: option.countryCode,
    icao: option.icao,
    airportName: option.name,
  }
}

function findAirportOptionsByCity(city: string) {
  const normalizedCity = city.trim().toLowerCase()

  if (normalizedCity.length < 2) {
    return []
  }

  return airportCatalog
    .filter((airport) => airport.city.toLowerCase() === normalizedCity)
    .sort((left, right) => {
      const leftHasIata = left.iata ? 0 : 1
      const rightHasIata = right.iata ? 0 : 1
      return leftHasIata - rightHasIata || left.name.localeCompare(right.name)
    })
    .slice(0, 8)
}

function getTourMapPoint(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const airportCoordinate = airportCoordinateLookup.get(normalizedCode)

  if (!airportCoordinate) {
    return null
  }

  const projectedPoint = tourMapProjection([airportCoordinate.longitude, airportCoordinate.latitude])

  if (!projectedPoint) {
    return null
  }

  return {
    code: normalizedCode,
    latitude: airportCoordinate.latitude,
    longitude: airportCoordinate.longitude,
    x: projectedPoint[0],
    y: projectedPoint[1],
  }
}

function projectTourMapCoordinate(longitude: number, latitude: number) {
  const projectedPoint = tourMapProjection([longitude, latitude])

  if (!projectedPoint) {
    return null
  }

  return {
    x: projectedPoint[0],
    y: projectedPoint[1],
  }
}

function parseBoundaryCoordinate(value: string | number | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }

  return null
}

function isTopLevelFirBoundary(id: string | undefined) {
  return typeof id === 'string' && /^[A-Z0-9]{4}$/.test(id.trim().toUpperCase())
}

function getBoundaryGeometryPositions(geometry: BoundaryGeometry) {
  const positions: GeoJsonPosition[] = []

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      positions.push(...ring)
    }

    return positions
  }

  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      positions.push(...ring)
    }
  }

  return positions
}

function getBoundaryCenterCoordinate(positions: GeoJsonPosition[]) {
  if (positions.length === 0) {
    return null
  }

  let minLongitude = Number.POSITIVE_INFINITY
  let maxLongitude = Number.NEGATIVE_INFINITY
  let minLatitude = Number.POSITIVE_INFINITY
  let maxLatitude = Number.NEGATIVE_INFINITY

  for (const [longitude, latitude] of positions) {
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }

  return [
    (minLongitude + maxLongitude) / 2,
    (minLatitude + maxLatitude) / 2,
  ] as GeoJsonPosition
}

function getBoundaryPolygons(geometry: BoundaryGeometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function getGeoJsonPolygonLongitudeMean(polygon: GeoJsonPolygonCoordinates) {
  const outerRing = polygon[0] ?? []

  if (outerRing.length === 0) {
    return 0
  }

  return outerRing.reduce((total, point) => total + point[0], 0) / outerRing.length
}

function getRenderableBoundaryGeometry(geometry: BoundaryGeometry, labelCoordinate: GeoJsonPosition | null): BoundaryGeometry {
  if (geometry.type !== 'MultiPolygon' || !labelCoordinate) {
    return geometry
  }

  const polygonLongitudeMeans = geometry.coordinates.map((polygon) => getGeoJsonPolygonLongitudeMean(polygon))
  const crossesDateline = polygonLongitudeMeans.some((longitude) => longitude <= -120)
    && polygonLongitudeMeans.some((longitude) => longitude >= 120)

  if (!crossesDateline) {
    return geometry
  }

  const keepPositiveLongitudes = labelCoordinate[0] >= 0
  const filteredCoordinates = geometry.coordinates.filter((polygon) => {
    const longitudeMean = getGeoJsonPolygonLongitudeMean(polygon)
    return keepPositiveLongitudes ? longitudeMean >= 0 : longitudeMean <= 0
  })

  if (filteredCoordinates.length === 0 || filteredCoordinates.length === geometry.coordinates.length) {
    return geometry
  }

  return {
    ...geometry,
    coordinates: filteredCoordinates,
  }
}

function getGeoJsonRingSignedArea(ring: GeoJsonLinearRing) {
  if (ring.length < 3) {
    return 0
  }

  let area = 0

  for (let index = 0; index < ring.length; index += 1) {
    const currentPoint = ring[index]
    const nextPoint = ring[(index + 1) % ring.length]
    area += currentPoint[0] * nextPoint[1] - nextPoint[0] * currentPoint[1]
  }

  return area / 2
}

function getGeoJsonRingCentroid(ring: GeoJsonLinearRing): GeoJsonPosition | null {
  if (ring.length < 3) {
    return ring[0] ?? null
  }

  const signedArea = getGeoJsonRingSignedArea(ring)

  if (Math.abs(signedArea) < 0.000001) {
    const longitudeAverage = ring.reduce((total, point) => total + point[0], 0) / ring.length
    const latitudeAverage = ring.reduce((total, point) => total + point[1], 0) / ring.length
    return [longitudeAverage, latitudeAverage] as GeoJsonPosition
  }

  let centroidLongitude = 0
  let centroidLatitude = 0

  for (let index = 0; index < ring.length; index += 1) {
    const currentPoint = ring[index]
    const nextPoint = ring[(index + 1) % ring.length]
    const crossProduct = currentPoint[0] * nextPoint[1] - nextPoint[0] * currentPoint[1]
    centroidLongitude += (currentPoint[0] + nextPoint[0]) * crossProduct
    centroidLatitude += (currentPoint[1] + nextPoint[1]) * crossProduct
  }

  const areaFactor = signedArea * 6
  return [centroidLongitude / areaFactor, centroidLatitude / areaFactor] as GeoJsonPosition
}

function isGeoJsonPointInRing(point: GeoJsonPosition, ring: GeoJsonLinearRing) {
  let isInside = false

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index, index += 1) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [previousLongitude, previousLatitude] = ring[previousIndex]
    const crossesLatitude = (currentLatitude > point[1]) !== (previousLatitude > point[1])

    if (!crossesLatitude) {
      continue
    }

    const intersectionLongitude = ((previousLongitude - currentLongitude) * (point[1] - currentLatitude)) / ((previousLatitude - currentLatitude) || 0.0000001) + currentLongitude

    if (point[0] < intersectionLongitude) {
      isInside = !isInside
    }
  }

  return isInside
}

function isGeoJsonPointInPolygon(point: GeoJsonPosition, polygon: GeoJsonPolygonCoordinates) {
  const [outerRing, ...holes] = polygon

  if (!outerRing || !isGeoJsonPointInRing(point, outerRing)) {
    return false
  }

  return !holes.some((holeRing) => isGeoJsonPointInRing(point, holeRing))
}

function isBoundaryPointInGeometry(point: GeoJsonPosition, geometry: BoundaryGeometry) {
  return getBoundaryPolygons(geometry).some((polygon) => isGeoJsonPointInPolygon(point, polygon))
}

function getGeoJsonPolygonBounds(polygon: GeoJsonPolygonCoordinates) {
  const outerRing = polygon[0] ?? []

  if (outerRing.length === 0) {
    return null
  }

  let minLongitude = Number.POSITIVE_INFINITY
  let maxLongitude = Number.NEGATIVE_INFINITY
  let minLatitude = Number.POSITIVE_INFINITY
  let maxLatitude = Number.NEGATIVE_INFINITY

  for (const [longitude, latitude] of outerRing) {
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }

  return {
    minLongitude,
    maxLongitude,
    minLatitude,
    maxLatitude,
  }
}

function getDistanceToSegment(point: GeoJsonPosition, fromPoint: GeoJsonPosition, toPoint: GeoJsonPosition) {
  const deltaX = toPoint[0] - fromPoint[0]
  const deltaY = toPoint[1] - fromPoint[1]

  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(point[0] - fromPoint[0], point[1] - fromPoint[1])
  }

  const projectedFactor = clampNumber(
    ((point[0] - fromPoint[0]) * deltaX + (point[1] - fromPoint[1]) * deltaY) / (deltaX * deltaX + deltaY * deltaY),
    0,
    1,
  )
  const projectedLongitude = fromPoint[0] + deltaX * projectedFactor
  const projectedLatitude = fromPoint[1] + deltaY * projectedFactor

  return Math.hypot(point[0] - projectedLongitude, point[1] - projectedLatitude)
}

function getDistanceToPolygonEdges(point: GeoJsonPosition, polygon: GeoJsonPolygonCoordinates) {
  let nearestEdgeDistance = Number.POSITIVE_INFINITY

  for (const ring of polygon) {
    for (let index = 0; index < ring.length; index += 1) {
      const currentPoint = ring[index]
      const nextPoint = ring[(index + 1) % ring.length]
      nearestEdgeDistance = Math.min(nearestEdgeDistance, getDistanceToSegment(point, currentPoint, nextPoint))
    }
  }

  return nearestEdgeDistance
}

function getBoundaryInteriorCoordinate(geometry: BoundaryGeometry, preferredCoordinate: GeoJsonPosition | null) {
  const polygons = getBoundaryPolygons(geometry)
    .map((polygon) => {
      const outerRing = polygon[0] ?? []
      const centroid = getGeoJsonRingCentroid(outerRing)
      const bounds = getGeoJsonPolygonBounds(polygon)
      const area = Math.abs(getGeoJsonRingSignedArea(outerRing))

      if (!centroid || !bounds || area <= 0) {
        return null
      }

      return {
        polygon,
        centroid,
        bounds,
        area,
      }
    })
    .filter((polygon): polygon is NonNullable<typeof polygon> => polygon !== null)
    .sort((left, right) => right.area - left.area)

  if (polygons.length === 0) {
    return preferredCoordinate
  }

  const primaryPolygon = polygons[0]
  const geometryWeightedCentroid = polygons.reduce<GeoJsonPosition>(
    (total, polygon) => [
      total[0] + polygon.centroid[0] * polygon.area,
      total[1] + polygon.centroid[1] * polygon.area,
    ],
    [0, 0],
  )
  const totalArea = polygons.reduce((sum, polygon) => sum + polygon.area, 0)
  const areaCentroid = [geometryWeightedCentroid[0] / totalArea, geometryWeightedCentroid[1] / totalArea] as GeoJsonPosition
  const boundsCenter = [
    (primaryPolygon.bounds.minLongitude + primaryPolygon.bounds.maxLongitude) / 2,
    (primaryPolygon.bounds.minLatitude + primaryPolygon.bounds.maxLatitude) / 2,
  ] as GeoJsonPosition
  const candidatePoints = [preferredCoordinate, primaryPolygon.centroid, areaCentroid, boundsCenter]
    .filter((candidate): candidate is GeoJsonPosition => candidate !== null)

  let bestPoint: GeoJsonPosition | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  const gridSteps = 18

  for (const candidatePoint of candidatePoints) {
    if (!polygons.some((polygon) => isGeoJsonPointInPolygon(candidatePoint, polygon.polygon))) {
      continue
    }

    const edgeDistance = polygons.reduce((nearestDistance, polygon) => {
      if (!isGeoJsonPointInPolygon(candidatePoint, polygon.polygon)) {
        return nearestDistance
      }

      return Math.min(nearestDistance, getDistanceToPolygonEdges(candidatePoint, polygon.polygon))
    }, Number.POSITIVE_INFINITY)
    const centroidDistance = Math.hypot(candidatePoint[0] - primaryPolygon.centroid[0], candidatePoint[1] - primaryPolygon.centroid[1])
    const score = edgeDistance * 2.4 - centroidDistance * 0.22

    if (score > bestScore) {
      bestPoint = candidatePoint
      bestScore = score
    }
  }

  for (let latitudeIndex = 1; latitudeIndex < gridSteps; latitudeIndex += 1) {
    const latitude = primaryPolygon.bounds.minLatitude
      + ((primaryPolygon.bounds.maxLatitude - primaryPolygon.bounds.minLatitude) * latitudeIndex) / gridSteps

    for (let longitudeIndex = 1; longitudeIndex < gridSteps; longitudeIndex += 1) {
      const longitude = primaryPolygon.bounds.minLongitude
        + ((primaryPolygon.bounds.maxLongitude - primaryPolygon.bounds.minLongitude) * longitudeIndex) / gridSteps
      const candidatePoint = [longitude, latitude] as GeoJsonPosition

      if (!isGeoJsonPointInPolygon(candidatePoint, primaryPolygon.polygon)) {
        continue
      }

      const edgeDistance = getDistanceToPolygonEdges(candidatePoint, primaryPolygon.polygon)
      const centroidDistance = Math.hypot(candidatePoint[0] - primaryPolygon.centroid[0], candidatePoint[1] - primaryPolygon.centroid[1])
      const preferredDistance = preferredCoordinate
        ? Math.hypot(candidatePoint[0] - preferredCoordinate[0], candidatePoint[1] - preferredCoordinate[1])
        : 0
      const score = edgeDistance * 3 - centroidDistance * 0.18 - preferredDistance * 0.08

      if (score > bestScore) {
        bestPoint = candidatePoint
        bestScore = score
      }
    }
  }

  return bestPoint ?? preferredCoordinate ?? primaryPolygon.centroid
}

function getBoundaryLabelCoordinate(feature: VatsimBoundaryFeature, positions: GeoJsonPosition[]) {
  const normalizedId = feature.properties.id?.trim().toUpperCase() ?? ''
  const overrideCoordinate = vatsimBoundaryLabelCoordinateOverrides[normalizedId]

  if (overrideCoordinate && isBoundaryPointInGeometry(overrideCoordinate, feature.geometry)) {
    return overrideCoordinate
  }

  if (overrideCoordinate) {
    const interiorOverrideCoordinate = getBoundaryInteriorCoordinate(feature.geometry, overrideCoordinate)

    if (interiorOverrideCoordinate) {
      return interiorOverrideCoordinate
    }
  }

  const labelLongitude = parseBoundaryCoordinate(feature.properties.label_lon)
  const labelLatitude = parseBoundaryCoordinate(feature.properties.label_lat)
  const sourceCoordinate = labelLongitude !== null && labelLatitude !== null
    ? [labelLongitude, labelLatitude] as GeoJsonPosition
    : null

  if (sourceCoordinate && isBoundaryPointInGeometry(sourceCoordinate, feature.geometry)) {
    return sourceCoordinate
  }

  const interiorCoordinate = getBoundaryInteriorCoordinate(feature.geometry, overrideCoordinate ?? sourceCoordinate)

  if (interiorCoordinate) {
    return interiorCoordinate
  }

  return getBoundaryCenterCoordinate(positions)
}

function getTourMapGeometryPath(geometry: BoundaryGeometry) {
  return tourMapPath(geometry as any) ?? ''
}

function getTourMapRegionLabelPoint(labelCoordinate: GeoJsonPosition | null) {
  if (!labelCoordinate) {
    return null
  }

  const projectedPoint = projectTourMapCoordinate(labelCoordinate[0], labelCoordinate[1])

  if (!projectedPoint) {
    return null
  }

  return {
    x: projectedPoint.x,
    y: projectedPoint.y,
  }
}

function getBoundaryBounds(positions: GeoJsonPosition[]) {
  if (positions.length === 0) {
    return null
  }

  let minLongitude = Number.POSITIVE_INFINITY
  let maxLongitude = Number.NEGATIVE_INFINITY
  let minLatitude = Number.POSITIVE_INFINITY
  let maxLatitude = Number.NEGATIVE_INFINITY

  for (const [longitude, latitude] of positions) {
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }

  return {
    minLongitude,
    maxLongitude,
    minLatitude,
    maxLatitude,
    longitudeSpan: Math.max(maxLongitude - minLongitude, 0),
    latitudeSpan: Math.max(maxLatitude - minLatitude, 0),
  }
}

function getBoundaryViewportPositions(
  positions: GeoJsonPosition[],
  labelCoordinate: GeoJsonPosition | null,
  bounds: ReturnType<typeof getBoundaryBounds>,
) {
  if (!bounds || !labelCoordinate) {
    return positions
  }

  const crossesDateline = bounds.longitudeSpan >= 300
    || (positions.some(([longitude]) => longitude <= -150) && positions.some(([longitude]) => longitude >= 150))

  if (!crossesDateline) {
    return positions
  }

  const keepPositiveLongitudes = labelCoordinate[0] >= 0
  const filteredPositions = positions.filter(([longitude]) => (keepPositiveLongitudes ? longitude >= 0 : longitude <= 0))

  return filteredPositions.length > 0 ? filteredPositions : positions
}

function getVatrusRegionPalette(labelCoordinate: GeoJsonPosition | null) {
  const longitude = labelCoordinate?.[0] ?? 0
  const latitude = labelCoordinate?.[1] ?? 0

  if (longitude < 34) {
    return {
      fill: 'rgba(112, 170, 214, 0.09)',
      stroke: 'rgba(156, 203, 236, 0.52)',
    }
  }

  if (longitude < 48 && latitude < 50) {
    return {
      fill: 'rgba(146, 172, 186, 0.09)',
      stroke: 'rgba(190, 210, 219, 0.5)',
    }
  }

  if (longitude < 50) {
    return {
      fill: 'rgba(124, 153, 192, 0.09)',
      stroke: 'rgba(171, 194, 227, 0.52)',
    }
  }

  if (longitude < 66) {
    return {
      fill: 'rgba(116, 174, 181, 0.09)',
      stroke: 'rgba(161, 214, 220, 0.52)',
    }
  }

  if (longitude < 110) {
    return {
      fill: 'rgba(132, 150, 205, 0.09)',
      stroke: 'rgba(178, 194, 236, 0.52)',
    }
  }

  return {
    fill: 'rgba(112, 174, 198, 0.09)',
    stroke: 'rgba(162, 214, 232, 0.52)',
  }
}

function getBoundaryAreaEstimate(positions: GeoJsonPosition[]) {
  if (positions.length === 0) {
    return 0
  }

  let minLongitude = Number.POSITIVE_INFINITY
  let maxLongitude = Number.NEGATIVE_INFINITY
  let minLatitude = Number.POSITIVE_INFINITY
  let maxLatitude = Number.NEGATIVE_INFINITY

  for (const [longitude, latitude] of positions) {
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }

  return Math.max(maxLongitude - minLongitude, 0) * Math.max(maxLatitude - minLatitude, 0)
}

function buildVatsimBoundaryOverlay(feature: VatsimBoundaryFeature): TourMapRegionOverlay | null {
  const normalizedId = feature.properties.id?.trim().toUpperCase()

  if (!normalizedId) {
    return null
  }

  const positions = getBoundaryGeometryPositions(feature.geometry)
  const labelCoordinate = getBoundaryLabelCoordinate(feature, positions)
  const renderGeometry = getRenderableBoundaryGeometry(feature.geometry, labelCoordinate)
  const renderPositions = getBoundaryGeometryPositions(renderGeometry)
  const labelPoint = getTourMapRegionLabelPoint(labelCoordinate)
  const path = getTourMapGeometryPath(renderGeometry)
  const bounds = getBoundaryBounds(renderPositions)
  const viewportPositions = getBoundaryViewportPositions(renderPositions, labelCoordinate, bounds)

  if (!path) {
    return null
  }

  const viewportPoints = viewportPositions.flatMap(([longitude, latitude]) => {
    const projectedPoint = projectTourMapCoordinate(longitude, latitude)
    return projectedPoint ? [projectedPoint] : []
  })
  const palette = getVatrusRegionPalette(labelCoordinate)
  const areaEstimate = getBoundaryAreaEstimate(renderPositions)

  const isOversizedBoundary = Boolean(
    bounds
    && (
      areaEstimate >= 220
      || bounds.longitudeSpan >= 28
      || bounds.latitudeSpan >= 16
      || bounds.maxLatitude >= 70
    ),
  )

  if (labelPoint) {
    viewportPoints.push(labelPoint)
  }

  return {
    key: normalizedId.toLowerCase(),
    label: normalizedId,
    fill: isOversizedBoundary ? 'none' : palette.fill,
    stroke: isOversizedBoundary ? 'rgba(168, 210, 228, 0.68)' : palette.stroke,
    path,
    showLabel: true,
    labelPoint,
    viewportPoints,
    labelPriority: areaEstimate,
  }
}

function buildSimawareBoundaryOverlay(record: SimawareBoundaryRecord): TourMapRegionOverlay | null {
  const normalizedId = record.feature.properties.id?.trim().toUpperCase()

  if (!normalizedId) {
    return null
  }

  const positions = getBoundaryGeometryPositions(record.feature.geometry)
  const path = getTourMapGeometryPath(record.feature.geometry)

  if (!path) {
    return null
  }

  const viewportPoints = positions.flatMap(([longitude, latitude]) => {
    const projectedPoint = projectTourMapCoordinate(longitude, latitude)
    return projectedPoint ? [projectedPoint] : []
  })

  return {
    key: `simaware-${normalizedId.toLowerCase()}`,
    label: normalizedId,
    fill: 'rgba(255, 255, 255, 0.01)',
    stroke: 'rgba(185, 205, 214, 0.24)',
    path,
    showLabel: false,
    labelPoint: null,
    viewportPoints,
    labelPriority: 0,
  }
}

function getVisibleTourMapRegionLabels(
  regions: TourMapRegionOverlay[],
  viewport: TourMapViewport,
  focusPoints: Array<{ x: number; y: number }>,
  zoomPercent = 100,
) {
  const manualZoomFactor = clampNumber(zoomPercent, 60, 320) / 100
  const isManualZoomedIn = manualZoomFactor >= 2.2
  const isManualZoomedFarIn = manualZoomFactor >= 2.8
  const isWideOverview = viewport.scale <= 1.45
  const minimumLabelDistance = isWideOverview
    ? 42
    : isManualZoomedFarIn ? 16 : isManualZoomedIn ? 22 : viewport.scale >= 6 ? 30 : viewport.scale >= 4 ? 36 : viewport.scale >= 2.5 ? 46 : 60
  const maxVisibleLabels = focusPoints.length > 0
    ? isWideOverview ? 14 : isManualZoomedFarIn ? 28 : isManualZoomedIn ? 24 : viewport.scale >= 6 ? 22 : viewport.scale >= 4 ? 18 : viewport.scale >= 2.5 ? 13 : 9
    : isWideOverview ? 12 : isManualZoomedFarIn ? 24 : isManualZoomedIn ? 20 : viewport.scale >= 6 ? 19 : viewport.scale >= 4 ? 15 : viewport.scale >= 2.5 ? 11 : 7
  const maxFocusDistance = isWideOverview
    ? Number.POSITIVE_INFINITY
    : isManualZoomedFarIn ? 1400 : isManualZoomedIn ? 1120 : viewport.scale >= 6 ? 980 : viewport.scale >= 4 ? 860 : viewport.scale >= 2.5 ? 620 : 380
  const copyBlockSafeMaxX = tourMapViewBox.width * 0.36
  const copyBlockSafeMaxY = tourMapViewBox.height * 0.82
  const regionLabelCandidates = viewport.scale >= 4
    ? [
        { dx: 0, dy: 0 },
        { dx: 30, dy: -10 },
        { dx: 32, dy: 12 },
        { dx: -30, dy: -10 },
        { dx: -32, dy: 12 },
        { dx: 0, dy: -20 },
        { dx: 0, dy: 22 },
        { dx: 44, dy: 0 },
        { dx: -44, dy: 0 },
        { dx: 46, dy: -18 },
        { dx: 46, dy: 18 },
        { dx: -46, dy: -18 },
        { dx: -46, dy: 18 },
        { dx: 16, dy: -28 },
        { dx: -16, dy: -28 },
        { dx: 18, dy: 30 },
        { dx: -18, dy: 30 },
        { dx: 60, dy: -10 },
        { dx: 60, dy: 12 },
        { dx: -60, dy: -10 },
        { dx: -60, dy: 12 },
        { dx: 0, dy: -34 },
        { dx: 0, dy: 36 },
        { dx: 76, dy: 0 },
        { dx: -76, dy: 0 },
        { dx: 74, dy: -24 },
        { dx: 74, dy: 24 },
        { dx: -74, dy: -24 },
        { dx: -74, dy: 24 },
      ]
    : [
        { dx: 0, dy: 0 },
        { dx: 24, dy: -8 },
        { dx: 24, dy: 10 },
        { dx: -24, dy: -8 },
        { dx: -24, dy: 10 },
        { dx: 34, dy: 0 },
        { dx: -34, dy: 0 },
        { dx: 12, dy: -20 },
        { dx: -12, dy: -20 },
        { dx: 12, dy: 22 },
        { dx: -12, dy: 22 },
        { dx: 42, dy: -8 },
        { dx: 42, dy: 10 },
        { dx: -42, dy: -8 },
        { dx: -42, dy: 10 },
        { dx: 0, dy: -28 },
        { dx: 0, dy: 30 },
      ]
  const transformedFocusPoints = focusPoints.map((point) => getViewportCoordinates(point, viewport))
  const visibleRegions = regions
    .flatMap((region) => {
      if (!region.labelPoint) {
        return [] as Array<never>
      }

      const baseScreenPoint = getViewportCoordinates(region.labelPoint, viewport)
      const screenOffset = vatsimBoundaryLabelScreenOffsets[region.label] ?? { dx: 0, dy: 0 }
      const screenPoint = {
        x: baseScreenPoint.x + screenOffset.dx,
        y: baseScreenPoint.y + screenOffset.dy,
      }
      const isWithinViewport = screenPoint.x >= 28
        && screenPoint.x <= tourMapViewBox.width - 28
        && screenPoint.y >= 26
        && screenPoint.y <= tourMapViewBox.height - 26

      if (!isWithinViewport) {
        return [] as Array<never>
      }

      const nearestFocusDistance = transformedFocusPoints.length > 0
        ? Math.min(...transformedFocusPoints.map((focusPoint) => Math.hypot(screenPoint.x - focusPoint.x, screenPoint.y - focusPoint.y)))
        : Number.POSITIVE_INFINITY

      if (transformedFocusPoints.length > 0 && nearestFocusDistance > maxFocusDistance) {
        return [] as Array<never>
      }

      return [{
        region,
        screenPoint,
        nearestFocusDistance,
        placementScore: nearestFocusDistance + clampNumber(region.labelPriority, 0, 360) * 0.22,
      }]
    })
    .sort((left, right) => {
      if (left.placementScore !== right.placementScore) {
        return left.placementScore - right.placementScore
      }

      if (left.nearestFocusDistance !== right.nearestFocusDistance) {
        return left.nearestFocusDistance - right.nearestFocusDistance
      }

      return left.region.labelPriority - right.region.labelPriority
    })

  const acceptedRegions: Array<{
    region: TourMapRegionOverlay
    screenPoint: { x: number; y: number }
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  }> = []

  const tryPlaceCandidate = (
    candidate: (typeof visibleRegions)[number],
    placementOptions: {
      minimumDistance: number
      viewportMarginX: number
      viewportMarginY: number
      allowPartialCopyBlock: boolean
    },
  ) => {
    const labelWidth = candidate.region.label.length * 6.8 + 10
    const labelHeight = 12

    for (const placement of regionLabelCandidates) {
      const nextPoint = {
        x: candidate.screenPoint.x + placement.dx,
        y: candidate.screenPoint.y + placement.dy,
      }
      const bounds = {
        minX: nextPoint.x - labelWidth / 2 - 4,
        maxX: nextPoint.x + labelWidth / 2 + 4,
        minY: nextPoint.y - labelHeight - 4,
        maxY: nextPoint.y + 4,
      }
      const isOutsideViewport = bounds.minX < placementOptions.viewportMarginX
        || bounds.maxX > tourMapViewBox.width - placementOptions.viewportMarginX
        || bounds.minY < placementOptions.viewportMarginY
        || bounds.maxY > tourMapViewBox.height - placementOptions.viewportMarginY
      const isInsideCopyBlock = bounds.minX <= copyBlockSafeMaxX && bounds.minY <= copyBlockSafeMaxY
      const isDeepInsideCopyBlock = bounds.maxX <= copyBlockSafeMaxX + 18 && bounds.maxY <= copyBlockSafeMaxY - 18
      const overlapsExistingLabel = acceptedRegions.some((acceptedRegion) => (
        doTourMapBoundsOverlap(bounds, acceptedRegion.bounds)
        || Math.hypot(
          nextPoint.x - acceptedRegion.screenPoint.x,
          nextPoint.y - acceptedRegion.screenPoint.y,
        ) < placementOptions.minimumDistance
      ))

      if (
        isOutsideViewport
        || overlapsExistingLabel
        || (isInsideCopyBlock && (!placementOptions.allowPartialCopyBlock || isDeepInsideCopyBlock))
      ) {
        continue
      }

      return {
        screenPoint: nextPoint,
        bounds,
      }
    }

    return null
  }

  for (const candidate of visibleRegions) {
    const selectedPlacement = tryPlaceCandidate(candidate, {
      minimumDistance: minimumLabelDistance,
      viewportMarginX: 20,
      viewportMarginY: 18,
      allowPartialCopyBlock: false,
    })

    if (!selectedPlacement) {
      continue
    }

    acceptedRegions.push({
      region: candidate.region,
      screenPoint: selectedPlacement.screenPoint,
      bounds: selectedPlacement.bounds,
    })

    if (acceptedRegions.length >= maxVisibleLabels) {
      break
    }
  }

  if (acceptedRegions.length < maxVisibleLabels) {
    for (const candidate of visibleRegions) {
      if (acceptedRegions.some((acceptedRegion) => acceptedRegion.region.key === candidate.region.key)) {
        continue
      }

      const selectedPlacement = tryPlaceCandidate(candidate, {
        minimumDistance: minimumLabelDistance * 0.72,
        viewportMarginX: 12,
        viewportMarginY: 12,
        allowPartialCopyBlock: true,
      })

      if (!selectedPlacement) {
        continue
      }

      acceptedRegions.push({
        region: candidate.region,
        screenPoint: selectedPlacement.screenPoint,
        bounds: selectedPlacement.bounds,
      })

      if (acceptedRegions.length >= maxVisibleLabels) {
        break
      }
    }
  }

  return acceptedRegions.map((acceptedRegion) => {
    const finalAdjustment = vatsimBoundaryLabelFinalAdjustments[acceptedRegion.region.label]

    if (!finalAdjustment) {
      return acceptedRegion
    }

    const adjustedScreenPoint = {
      x: acceptedRegion.screenPoint.x + finalAdjustment.dx,
      y: acceptedRegion.screenPoint.y + finalAdjustment.dy,
    }
    const adjustedBounds = {
      minX: acceptedRegion.bounds.minX + finalAdjustment.dx,
      maxX: acceptedRegion.bounds.maxX + finalAdjustment.dx,
      minY: acceptedRegion.bounds.minY + finalAdjustment.dy,
      maxY: acceptedRegion.bounds.maxY + finalAdjustment.dy,
    }

    return {
      ...acceptedRegion,
      screenPoint: adjustedScreenPoint,
      bounds: adjustedBounds,
    }
  })
}

function buildTourSegmentPath(fromPoint: TourMapPoint, toPoint: TourMapPoint) {
  const interpolate = geoInterpolate(
    [fromPoint.longitude, fromPoint.latitude],
    [toPoint.longitude, toPoint.latitude],
  )
  const segments = Math.max(24, Math.ceil(Math.hypot(fromPoint.x - toPoint.x, fromPoint.y - toPoint.y) / 20))
  let path = ''

  for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
    const interpolatedPoint = interpolate(segmentIndex / segments)
    const projectedPoint = tourMapProjection(interpolatedPoint)

    if (!projectedPoint) {
      continue
    }

    path += `${segmentIndex === 0 ? 'M' : 'L'} ${projectedPoint[0].toFixed(1)} ${projectedPoint[1].toFixed(1)} `
  }

  return path.trim()
}

function getTourMapData(legs: TourMapLeg[]) {
  const pointsByCode = new Map<string, TourMapPoint>()
  const points: TourMapPoint[] = []
  const segments: TourMapSegment[] = []

  for (const code of getTourStops(legs)) {
    if (pointsByCode.has(code)) {
      continue
    }

    const point = getTourMapPoint(code)

    if (!point) {
      continue
    }

    pointsByCode.set(code, point)
    points.push(point)
  }

  legs.forEach((leg, index) => {
    const fromPoint = pointsByCode.get(leg.from)
    const toPoint = pointsByCode.get(leg.to)

    if (!fromPoint || !toPoint) {
      return
    }

    segments.push({
      key: `${leg.from}-${leg.to}-${index}`,
      path: buildTourSegmentPath(fromPoint, toPoint),
      tone: leg.tone ?? 'default',
    })
  })

  return {
    points,
    segments,
  }
}

function getTourMapViewport(
  points: Array<{ x: number; y: number }>,
  zoomPercent = 100,
  panOffsetX = 0,
  panOffsetY = 0,
): TourMapViewport {
  if (points.length === 0) {
    return {
      scale: 1,
      translateX: panOffsetX,
      translateY: panOffsetY,
    }
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  const routeWidth = Math.max(maxX - minX, tourMapViewBox.width * 0.06)
  const routeHeight = Math.max(maxY - minY, tourMapViewBox.height * 0.06)
  const contextPaddingX = Math.max(96, routeWidth * 1.12)
  const contextPaddingY = Math.max(82, routeHeight * 1.26)
  const viewportMinX = clamp(minX - contextPaddingX, 0, tourMapViewBox.width)
  const viewportMaxX = clamp(maxX + contextPaddingX, 0, tourMapViewBox.width)
  const viewportMinY = clamp(minY - contextPaddingY, 0, tourMapViewBox.height)
  const viewportMaxY = clamp(maxY + contextPaddingY, 0, tourMapViewBox.height)
  const viewportWidth = Math.max(viewportMaxX - viewportMinX, tourMapViewBox.width * 0.21)
  const viewportHeight = Math.max(viewportMaxY - viewportMinY, tourMapViewBox.height * 0.24)
  const autoScale = clamp(
    Math.min(tourMapViewBox.width / viewportWidth, tourMapViewBox.height / viewportHeight),
    1,
    4.25,
  )
  const zoomFactor = clampNumber(zoomPercent, 60, 320) / 100
  const scale = clamp(autoScale * zoomFactor, 0.7, 9.25)
  const viewportCenterX = (viewportMinX + viewportMaxX) / 2
  const viewportCenterY = (viewportMinY + viewportMaxY) / 2
  const targetCenterX = tourMapViewBox.width * 0.63
  const targetCenterY = tourMapViewBox.height * 0.53

  return {
    scale,
    translateX: targetCenterX - viewportCenterX * scale + panOffsetX,
    translateY: targetCenterY - viewportCenterY * scale + panOffsetY,
  }
}

function getTourMapPanLimits(
  points: Array<{ x: number; y: number }>,
  zoomPercent = 100,
) {
  if (points.length === 0) {
    return {
      maxOffsetX: 420,
      maxOffsetY: 280,
    }
  }

  const minX = Math.min(...points.map((point) => point.x))
  const maxX = Math.max(...points.map((point) => point.x))
  const minY = Math.min(...points.map((point) => point.y))
  const maxY = Math.max(...points.map((point) => point.y))
  const routeWidth = Math.max(maxX - minX, tourMapViewBox.width * 0.06)
  const routeHeight = Math.max(maxY - minY, tourMapViewBox.height * 0.06)
  const contextPaddingX = Math.max(96, routeWidth * 1.12)
  const contextPaddingY = Math.max(82, routeHeight * 1.26)
  const viewportMinX = clamp(minX - contextPaddingX, 0, tourMapViewBox.width)
  const viewportMaxX = clamp(maxX + contextPaddingX, 0, tourMapViewBox.width)
  const viewportMinY = clamp(minY - contextPaddingY, 0, tourMapViewBox.height)
  const viewportMaxY = clamp(maxY + contextPaddingY, 0, tourMapViewBox.height)
  const viewportWidth = Math.max(viewportMaxX - viewportMinX, tourMapViewBox.width * 0.21)
  const viewportHeight = Math.max(viewportMaxY - viewportMinY, tourMapViewBox.height * 0.24)
  const autoScale = clamp(
    Math.min(tourMapViewBox.width / viewportWidth, tourMapViewBox.height / viewportHeight),
    1,
    4.25,
  )
  const zoomFactor = clampNumber(zoomPercent, 60, 320) / 100
  const scale = clamp(autoScale * zoomFactor, 0.7, 9.25)

  return {
    maxOffsetX: Math.round(clampNumber(Math.max((scale - 1) * 180, (viewportWidth * scale - tourMapViewBox.width) * 0.92, 280), 280, 1650)),
    maxOffsetY: Math.round(clampNumber(Math.max((scale - 1) * 120, (viewportHeight * scale - tourMapViewBox.height) * 0.92, 180), 180, 980)),
  }
}

function getViewportPoint(point: TourMapPoint, viewport: TourMapViewport) {
  return {
    x: point.x * viewport.scale + viewport.translateX,
    y: point.y * viewport.scale + viewport.translateY,
  }
}

function getViewportCoordinates(point: { x: number; y: number }, viewport: TourMapViewport) {
  return {
    x: point.x * viewport.scale + viewport.translateX,
    y: point.y * viewport.scale + viewport.translateY,
  }
}

function getTourMapLabelPosition(point: { x: number; y: number }) {
  const textAnchor: 'start' | 'middle' | 'end' =
    point.x < 120 ? 'start' : point.x > tourMapViewBox.width - 120 ? 'end' : 'middle'

  return {
    textAnchor,
    x: textAnchor === 'start' ? 7 : textAnchor === 'end' ? -7 : 0,
    y: point.y > tourMapViewBox.height - 124 ? -9 : -12,
  }
}

function doTourMapBoundsOverlap(
  left: { minX: number; maxX: number; minY: number; maxY: number },
  right: { minX: number; maxX: number; minY: number; maxY: number },
) {
  return !(left.maxX <= right.minX || left.minX >= right.maxX || left.maxY <= right.minY || left.minY >= right.maxY)
}

function buildTourMapLabelPlacement(
  displayPoint: { x: number; y: number },
  code: string,
  textAnchor: 'start' | 'middle' | 'end',
  x: number,
  y: number,
  showFlag: boolean,
): TourMapLabelPlacement {
  const labelWidth = code.length * 7.8 + 5
  const labelHeight = 14
  const labelLeft = displayPoint.x + (textAnchor === 'start' ? x : textAnchor === 'end' ? x - labelWidth : x - labelWidth / 2)
  const labelTop = displayPoint.y + y - labelHeight
  const bounds = {
    minX: labelLeft - 2,
    maxX: labelLeft + labelWidth + 2,
    minY: labelTop - 2,
    maxY: labelTop + labelHeight + 3,
  }

  if (!showFlag) {
    return {
      textAnchor,
      x,
      y,
      showFlag,
      flagX: 0,
      flagY: 0,
      bounds,
      flagBounds: null,
    }
  }

  const flagPosition = getTourMapLabelFlagPosition({ textAnchor, x, y }, code)

  return {
    textAnchor,
    x,
    y,
    showFlag,
    flagX: flagPosition.x,
    flagY: flagPosition.y,
    bounds,
    flagBounds: {
      minX: displayPoint.x + flagPosition.x,
      maxX: displayPoint.x + flagPosition.x + 18,
      minY: displayPoint.y + flagPosition.y,
      maxY: displayPoint.y + flagPosition.y + 13,
    },
  }
}

function getTourMapPointLabelPlacements(
  points: TourMapPoint[],
  viewport: TourMapViewport,
  showFlags: boolean,
) {
  const occupiedBounds: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = []
  const placements = new Map<string, TourMapLabelPlacement>()

  const pointEntries = points.map((point, index) => ({
    key: `${point.code}-${index}`,
    point,
    index,
    isStartPoint: index === 0,
    displayPoint: getViewportPoint(point, viewport),
    canShowFlag: showFlags && Boolean(getFlagAssetCode(getIcaoCountryCode(point.code))),
  }))

  const candidatePlacements: Array<Pick<TourMapLabelPlacement, 'textAnchor' | 'x' | 'y'>> = [
    { textAnchor: 'start', x: 11, y: -14 },
    { textAnchor: 'end', x: -11, y: -14 },
    { textAnchor: 'start', x: 11, y: 18 },
    { textAnchor: 'end', x: -11, y: 18 },
    { textAnchor: 'middle', x: 0, y: -16 },
    { textAnchor: 'start', x: 14, y: 4 },
    { textAnchor: 'end', x: -14, y: 4 },
  ]

  pointEntries
    .sort((left, right) => Number(right.isStartPoint) - Number(left.isStartPoint) || left.index - right.index)
    .forEach((entry) => {
      const nodeRadius = entry.isStartPoint ? 15 : 12
      const nodeBounds = {
        minX: entry.displayPoint.x - nodeRadius,
        maxX: entry.displayPoint.x + nodeRadius,
        minY: entry.displayPoint.y - nodeRadius,
        maxY: entry.displayPoint.y + nodeRadius,
      }

      let selectedPlacement: TourMapLabelPlacement | null = null

      for (const candidate of candidatePlacements) {
        for (const showFlagCandidate of entry.canShowFlag ? [true, false] : [false]) {
          const placement = buildTourMapLabelPlacement(
            entry.displayPoint,
            entry.point.code,
            candidate.textAnchor,
            candidate.x,
            candidate.y,
            showFlagCandidate,
          )

          const isOutOfBounds = placement.bounds.minX < 6
            || placement.bounds.maxX > tourMapViewBox.width - 6
            || placement.bounds.minY < 6
            || placement.bounds.maxY > tourMapViewBox.height - 6
            || (placement.flagBounds !== null && (
              placement.flagBounds.minX < 6
              || placement.flagBounds.maxX > tourMapViewBox.width - 6
              || placement.flagBounds.minY < 6
              || placement.flagBounds.maxY > tourMapViewBox.height - 6
            ))

          if (isOutOfBounds) {
            continue
          }

          const overlapsExisting = occupiedBounds.some((bounds) => (
            doTourMapBoundsOverlap(bounds, placement.bounds)
            || (placement.flagBounds !== null && doTourMapBoundsOverlap(bounds, placement.flagBounds))
          ))

          const overlapsNode = doTourMapBoundsOverlap(nodeBounds, placement.bounds)
            || (placement.flagBounds !== null && doTourMapBoundsOverlap(nodeBounds, placement.flagBounds))

          if (!overlapsExisting && !overlapsNode) {
            selectedPlacement = placement
            break
          }
        }

        if (selectedPlacement) {
          break
        }
      }

      if (!selectedPlacement) {
        selectedPlacement = buildTourMapLabelPlacement(entry.displayPoint, entry.point.code, 'start', 11, -14, false)
      }

      placements.set(entry.key, selectedPlacement)
      occupiedBounds.push(selectedPlacement.bounds)

      if (selectedPlacement.flagBounds) {
        occupiedBounds.push(selectedPlacement.flagBounds)
      }
    })

  return placements
}

function getTourMapLabelFlagPosition(labelPosition: ReturnType<typeof getTourMapLabelPosition>, code: string) {
  const labelWidth = code.length * 7.8 + 5
  const flagWidth = 18
  const flagGap = 6

  if (labelPosition.textAnchor === 'end') {
    return {
      x: labelPosition.x - labelWidth - flagGap - flagWidth,
      y: labelPosition.y - 11,
    }
  }

  return {
    x: labelPosition.x + (labelPosition.textAnchor === 'middle' ? labelWidth / 2 : labelWidth) + flagGap,
    y: labelPosition.y - 11,
  }
}

function TourRouteMap({
  legs,
  showFlags,
  showLegend = false,
  highlightedRegionOverlays = [],
  detailRegionOverlays = [],
  zoomPercent = 100,
  panOffsetX = 0,
  panOffsetY = 0,
  isInteractive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  legs: TourMapLeg[]
  showFlags: boolean
  showLegend?: boolean
  highlightedRegionOverlays?: TourMapRegionOverlay[]
  detailRegionOverlays?: TourMapRegionOverlay[]
  zoomPercent?: number
  panOffsetX?: number
  panOffsetY?: number
  isInteractive?: boolean
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>
}) {
  const { points, segments } = getTourMapData(legs)
  const viewportPoints = [...highlightedRegionOverlays.flatMap((region) => region.viewportPoints), ...detailRegionOverlays.flatMap((region) => region.viewportPoints), ...points]
  const viewport = getTourMapViewport(viewportPoints, zoomPercent, panOffsetX, panOffsetY)
  const pointLabelPlacements = getTourMapPointLabelPlacements(points, viewport, showFlags)
  const visibleRegionLabels = getVisibleTourMapRegionLabels(highlightedRegionOverlays, viewport, points, zoomPercent)
  const visibleMapMargin = 28 / viewport.scale
  const visibleMapBounds = {
    minX: (0 - viewport.translateX) / viewport.scale - visibleMapMargin,
    maxX: (tourMapViewBox.width - viewport.translateX) / viewport.scale + visibleMapMargin,
    minY: (0 - viewport.translateY) / viewport.scale - visibleMapMargin,
    maxY: (tourMapViewBox.height - viewport.translateY) / viewport.scale + visibleMapMargin,
  }
  const mountainFocusPoints = points.length > 0
    ? points
    : [
        ...highlightedRegionOverlays.flatMap((region) => region.viewportPoints),
        ...detailRegionOverlays.flatMap((region) => region.viewportPoints),
      ]
  const focusViewportBounds = mountainFocusPoints.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )
  const focusMapPadding = 118 / viewport.scale
  const mountainFocusBounds = Number.isFinite(focusViewportBounds.minX)
    ? {
        minX: focusViewportBounds.minX - focusMapPadding,
        maxX: focusViewportBounds.maxX + focusMapPadding,
        minY: focusViewportBounds.minY - focusMapPadding,
        maxY: focusViewportBounds.maxY + focusMapPadding,
      }
    : visibleMapBounds
  const visibleMountainRanges = tourMapMountainRanges.filter((range) => {
    const screenArea = range.area * viewport.scale * viewport.scale

    if (screenArea < 520) {
      return false
    }

    return !(
      range.bounds.maxX < visibleMapBounds.minX
      || range.bounds.minX > visibleMapBounds.maxX
      || range.bounds.maxY < visibleMapBounds.minY
      || range.bounds.minY > visibleMapBounds.maxY
      || range.bounds.maxX < mountainFocusBounds.minX
      || range.bounds.minX > mountainFocusBounds.maxX
      || range.bounds.maxY < mountainFocusBounds.minY
      || range.bounds.minY > mountainFocusBounds.maxY
    )
  })
  const visibleSteppeRegions = tourMapSteppeRegions.filter((region) => {
    const screenArea = region.area * viewport.scale * viewport.scale

    if (screenArea < 320) {
      return false
    }

    return !(
      region.bounds.maxX < visibleMapBounds.minX
      || region.bounds.minX > visibleMapBounds.maxX
      || region.bounds.maxY < visibleMapBounds.minY
      || region.bounds.minY > visibleMapBounds.maxY
    )
  })
  const visibleLakes = tourMapLakes.filter((lake) => {
    const screenArea = lake.area * viewport.scale * viewport.scale

    if (screenArea < 18) {
      return false
    }

    return !(
      lake.bounds.maxX < visibleMapBounds.minX
      || lake.bounds.minX > visibleMapBounds.maxX
      || lake.bounds.maxY < visibleMapBounds.minY
      || lake.bounds.minY > visibleMapBounds.maxY
    )
  })
  const visibleRivers = tourMapRivers.filter((river) => {
    const screenWidth = (river.bounds.maxX - river.bounds.minX) * viewport.scale
    const screenHeight = (river.bounds.maxY - river.bounds.minY) * viewport.scale

    if (Math.max(screenWidth, screenHeight) < 30) {
      return false
    }

    return !(
      river.bounds.maxX < visibleMapBounds.minX
      || river.bounds.minX > visibleMapBounds.maxX
      || river.bounds.maxY < visibleMapBounds.minY
      || river.bounds.minY > visibleMapBounds.maxY
    )
  })

  return (
    <div
      className={`banner-tour-map${isInteractive ? ' is-interactive' : ''}`}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <svg
        className="banner-tour-map-svg"
        viewBox={`0 0 ${tourMapViewBox.width} ${tourMapViewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="tour-route-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>

          <radialGradient id="tour-map-theme-ocean-dark" cx="52%" cy="40%" r="85%">
            <stop offset="0%" stopColor="#17324a" />
            <stop offset="58%" stopColor="#102435" />
            <stop offset="100%" stopColor="#08111b" />
          </radialGradient>
          <radialGradient id="tour-map-theme-ocean-light" cx="50%" cy="38%" r="88%">
            <stop offset="0%" stopColor="#eff7fb" />
            <stop offset="56%" stopColor="#d6e4ed" />
            <stop offset="100%" stopColor="#bdd0dd" />
          </radialGradient>
          <radialGradient id="tour-map-theme-ocean-satellite" cx="46%" cy="36%" r="92%">
            <stop offset="0%" stopColor="#31798b" />
            <stop offset="26%" stopColor="#225b6d" />
            <stop offset="56%" stopColor="#153d50" />
            <stop offset="82%" stopColor="#0a2231" />
            <stop offset="100%" stopColor="#050d16" />
          </radialGradient>
          <radialGradient id="tour-map-theme-ocean-satellite-depth" cx="58%" cy="44%" r="94%">
            <stop offset="0%" stopColor="rgba(150, 214, 225, 0.18)" />
            <stop offset="26%" stopColor="rgba(71, 135, 158, 0.12)" />
            <stop offset="62%" stopColor="rgba(13, 47, 67, 0.32)" />
            <stop offset="100%" stopColor="rgba(2, 8, 12, 0.76)" />
          </radialGradient>
          <radialGradient id="tour-map-theme-satellite-atmosphere" cx="24%" cy="18%" r="92%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="14%" stopColor="rgba(188,226,232,0.16)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="56%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(4,10,15,0.22)" />
          </radialGradient>

          <linearGradient id="tour-map-theme-land-satellite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5af72" />
            <stop offset="18%" stopColor="#7d9560" />
            <stop offset="38%" stopColor="#6c8051" />
            <stop offset="58%" stopColor="#8f7b54" />
            <stop offset="80%" stopColor="#5d6541" />
            <stop offset="100%" stopColor="#334231" />
          </linearGradient>
          <linearGradient id="tour-map-theme-land-satellite-rim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(251, 246, 210, 0.44)" />
            <stop offset="46%" stopColor="rgba(223, 214, 159, 0.2)" />
            <stop offset="100%" stopColor="rgba(28, 38, 26, 0.1)" />
          </linearGradient>
          <linearGradient id="tour-map-theme-land-satellite-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.24)" />
            <stop offset="54%" stopColor="rgba(255,240,194,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <pattern id="tour-map-theme-satellite-relief" width="168" height="168" patternUnits="userSpaceOnUse">
            <rect width="168" height="168" fill="rgba(0,0,0,0)" />
            <path d="M-10 34 C18 8 44 6 70 18 C95 30 118 30 146 10 C154 4 161 2 174 0" fill="none" stroke="rgba(33, 52, 29, 0.24)" strokeWidth="4.8" strokeLinecap="round" />
            <path d="M-6 52 C18 34 36 30 60 38 C85 46 108 44 138 26 C152 18 160 14 174 12" fill="none" stroke="rgba(240, 233, 192, 0.14)" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M2 92 C26 70 50 66 78 76 C100 84 122 80 154 58 C162 52 168 48 174 44" fill="none" stroke="rgba(31, 45, 25, 0.2)" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M10 112 C28 96 52 92 78 100 C104 108 126 102 160 82" fill="none" stroke="rgba(244, 238, 206, 0.1)" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M-8 144 C16 126 44 122 72 132 C96 140 126 136 174 108" fill="none" stroke="rgba(38, 56, 30, 0.18)" strokeWidth="4.1" strokeLinecap="round" />
          </pattern>
          <pattern id="tour-map-theme-satellite-steppe" width="156" height="156" patternUnits="userSpaceOnUse">
            <rect width="156" height="156" fill="rgba(0,0,0,0)" />
            <path d="M14 24 C26 14 40 14 54 22 C64 28 74 28 88 18" fill="none" stroke="rgba(64, 86, 48, 0.2)" strokeWidth="4.4" strokeLinecap="round" />
            <path d="M18 30 C30 22 42 22 56 28 C66 32 76 32 90 24" fill="none" stroke="rgba(224, 210, 160, 0.12)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M92 42 C104 30 120 30 136 40 C142 44 148 44 160 38" fill="none" stroke="rgba(71, 93, 53, 0.18)" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M96 50 C108 40 122 40 136 46 C144 50 150 50 160 44" fill="none" stroke="rgba(228, 216, 168, 0.1)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M24 78 C38 68 52 68 68 76 C80 82 92 82 108 72" fill="none" stroke="rgba(69, 90, 52, 0.18)" strokeWidth="4.6" strokeLinecap="round" />
            <path d="M28 86 C40 78 54 78 68 84 C80 88 92 88 106 80" fill="none" stroke="rgba(219, 204, 154, 0.1)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M86 102 C102 90 118 92 136 102 C146 108 154 108 166 100" fill="none" stroke="rgba(67, 88, 50, 0.16)" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M12 122 C24 112 40 112 54 120 C64 126 76 126 88 118" fill="none" stroke="rgba(72, 92, 53, 0.16)" strokeWidth="4" strokeLinecap="round" />
            <path d="M16 128 C28 120 40 120 54 126 C64 130 74 130 86 124" fill="none" stroke="rgba(221, 206, 156, 0.09)" strokeWidth="2" strokeLinecap="round" />
          </pattern>
          <pattern id="tour-map-theme-satellite-rivers" width="220" height="220" patternUnits="userSpaceOnUse">
            <rect width="220" height="220" fill="rgba(0,0,0,0)" />
            <path d="M18 18 C34 36 36 58 34 82 C32 106 38 128 56 154 C70 174 72 194 66 222" fill="none" stroke="rgba(178, 220, 214, 0.08)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M34 86 C54 92 74 104 90 126" fill="none" stroke="rgba(178, 220, 214, 0.06)" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M120 -8 C136 20 138 48 132 78 C124 116 130 140 152 172 C162 186 166 202 162 228" fill="none" stroke="rgba(182, 224, 221, 0.08)" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M132 76 C148 82 164 94 178 114" fill="none" stroke="rgba(182, 224, 221, 0.05)" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M198 24 C182 46 178 72 182 98 C186 124 180 148 162 176" fill="none" stroke="rgba(171, 216, 212, 0.07)" strokeWidth="1.8" strokeLinecap="round" />
          </pattern>
          <filter id="tour-map-theme-satellite-coast-blur" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="1.9" />
          </filter>
          <pattern id="tour-map-theme-satellite-texture" width="96" height="96" patternUnits="userSpaceOnUse">
            <rect width="96" height="96" fill="rgba(0,0,0,0)" />
            <ellipse cx="22" cy="18" rx="10" ry="6" fill="rgba(132, 153, 90, 0.08)" />
            <ellipse cx="70" cy="64" rx="12" ry="8" fill="rgba(144, 126, 82, 0.06)" />
            <path d="M8 18 C18 10 30 10 42 18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M50 24 C62 14 74 14 88 22" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18 52 C28 42 40 42 54 50" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M56 60 C68 50 80 50 92 58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 80 C24 70 38 70 52 78" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="24" cy="36" r="4" fill="rgba(255,255,255,0.03)" />
            <circle cx="72" cy="28" r="5" fill="rgba(0,0,0,0.05)" />
            <circle cx="62" cy="78" r="4" fill="rgba(255,255,255,0.03)" />
          </pattern>
          <pattern id="tour-map-theme-satellite-ocean-texture" width="144" height="144" patternUnits="userSpaceOnUse">
            <rect width="144" height="144" fill="rgba(0,0,0,0)" />
            <path d="M12 20 C30 10 48 10 66 18" fill="none" stroke="rgba(168, 214, 226, 0.08)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M82 34 C102 24 120 26 140 36" fill="none" stroke="rgba(0, 0, 0, 0.1)" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 74 C38 62 58 64 80 74" fill="none" stroke="rgba(145, 195, 210, 0.07)" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M90 98 C108 88 126 90 146 100" fill="none" stroke="rgba(0, 0, 0, 0.08)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M24 120 C44 110 64 110 82 118" fill="none" stroke="rgba(163, 206, 219, 0.06)" strokeWidth="2.2" strokeLinecap="round" />
          </pattern>
          <pattern id="tour-map-theme-satellite-land-grain" width="84" height="84" patternUnits="userSpaceOnUse">
            <rect width="84" height="84" fill="rgba(0,0,0,0)" />
            <circle cx="10" cy="12" r="2.6" fill="rgba(255,255,255,0.03)" />
            <circle cx="28" cy="22" r="1.8" fill="rgba(0,0,0,0.06)" />
            <circle cx="58" cy="16" r="2.4" fill="rgba(255,255,255,0.025)" />
            <circle cx="68" cy="34" r="2.8" fill="rgba(0,0,0,0.05)" />
            <circle cx="22" cy="54" r="2.2" fill="rgba(255,255,255,0.03)" />
            <circle cx="48" cy="64" r="2.8" fill="rgba(0,0,0,0.05)" />
            <circle cx="72" cy="70" r="2.2" fill="rgba(255,255,255,0.025)" />
            <circle cx="38" cy="40" r="1.6" fill="rgba(0,0,0,0.04)" />
          </pattern>
          <pattern id="tour-map-theme-satellite-clouds" width="360" height="220" patternUnits="userSpaceOnUse">
            <rect width="360" height="220" fill="rgba(0,0,0,0)" />
            <path d="M28 58 C72 30 116 30 162 50 C192 62 216 62 246 50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="10" strokeLinecap="round" />
            <path d="M190 126 C226 106 262 106 300 122 C326 132 346 132 372 122" fill="none" stroke="rgba(222,236,240,0.03)" strokeWidth="8" strokeLinecap="round" />
          </pattern>
          <clipPath id="tour-map-land-clip">
            <path d={tourMapLandPath} />
          </clipPath>
        </defs>

        <rect className="banner-tour-map-theme-wash" x="0" y="0" width={tourMapViewBox.width} height={tourMapViewBox.height} />
        <rect className="banner-tour-map-theme-depth" x="0" y="0" width={tourMapViewBox.width} height={tourMapViewBox.height} />
        <rect className="banner-tour-map-theme-ocean-texture" x="0" y="0" width={tourMapViewBox.width} height={tourMapViewBox.height} />
        <rect className="banner-tour-map-theme-atmosphere" x="0" y="0" width={tourMapViewBox.width} height={tourMapViewBox.height} />
        <rect className="banner-tour-map-theme-clouds" x="0" y="0" width={tourMapViewBox.width} height={tourMapViewBox.height} />

        <g transform={`translate(${viewport.translateX.toFixed(1)} ${viewport.translateY.toFixed(1)}) scale(${viewport.scale.toFixed(3)})`}>
          <path className="banner-tour-map-graticule" d={tourMapGraticulePath} vectorEffect="non-scaling-stroke" />
          <image
            className="banner-tour-map-satellite-basemap"
            href={tourMapSatelliteReliefAsset}
            x="0"
            y="0"
            width={tourMapViewBox.width}
            height={tourMapViewBox.height}
            preserveAspectRatio="none"
            clipPath="url(#tour-map-land-clip)"
          />
          <g className="banner-tour-map-steppe-overlays" clipPath="url(#tour-map-land-clip)">
            {visibleSteppeRegions.map((region) => (
              <path key={region.key} className="banner-tour-map-steppe-region" d={region.path} />
            ))}
          </g>
          <path className="banner-tour-map-land-shadow" d={tourMapLandPath} transform="translate(8 10)" vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-lowlight" d={tourMapLandPath} transform="translate(4 5)" vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-relief" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-steppe" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-rivers" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-texture" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-grain" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-highlight" d={tourMapLandPath} transform="translate(-2 -3)" vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-coast-soft" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-coast-crisp" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />
          <path className="banner-tour-map-land-rim" d={tourMapLandPath} vectorEffect="non-scaling-stroke" />

          {highlightedRegionOverlays.map((region) => (
            <path
              key={region.key}
              className="banner-tour-map-region"
              d={region.path}
              vectorEffect="non-scaling-stroke"
              style={{ fill: region.fill, stroke: region.stroke }}
            />
          ))}

          {detailRegionOverlays.map((region) => (
            <path
              key={region.key}
              className="banner-tour-map-region-detail"
              d={region.path}
              vectorEffect="non-scaling-stroke"
              style={{ fill: region.fill, stroke: region.stroke }}
            />
          ))}

          <g className="banner-tour-map-hydro-overlays" clipPath="url(#tour-map-land-clip)">
            {visibleLakes.map((lake) => (
              <path key={lake.key} className="banner-tour-map-lake" d={lake.path} />
            ))}
            {visibleRivers.map((river) => (
              <path key={river.key} className="banner-tour-map-river" d={river.path} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          <g className="banner-tour-map-mountain-overlays" clipPath="url(#tour-map-land-clip)">
            {visibleMountainRanges.map((range) => {
              return (
                <g key={range.key}>
                  <path className="banner-tour-map-mountain-shadow" d={range.path} transform="translate(2 2.6)" />
                  <path className="banner-tour-map-mountain-highlight" d={range.path} transform="translate(-0.8 -1)" />
                  <path className="banner-tour-map-mountain-mass-shadow" d={range.path} />
                  <path className="banner-tour-map-mountain-mass-highlight" d={range.path} transform="translate(-0.4 -0.6)" />
                </g>
              )
            })}
          </g>

          {segments.map((segment) => (
            <path
              key={segment.key}
              className={`banner-tour-map-route is-${segment.tone}`}
              d={segment.path}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {visibleRegionLabels.map(({ region, screenPoint }) => (
          <text
            key={`${region.key}-label`}
            className="banner-tour-map-region-label"
            x={screenPoint.x}
            y={screenPoint.y}
            textAnchor="middle"
          >
            {region.label}
          </text>
        ))}

        {points.map((point, index) => {
          const isStartPoint = index === 0
          const displayPoint = getViewportPoint(point, viewport)
          const labelPlacement = pointLabelPlacements.get(`${point.code}-${index}`) ?? buildTourMapLabelPlacement(displayPoint, point.code, 'start', 11, -14, false)
          const flagCode = labelPlacement.showFlag ? getFlagAssetCode(getIcaoCountryCode(point.code)) : null

          return (
            <g key={`${point.code}-${index}`} transform={`translate(${displayPoint.x} ${displayPoint.y})`}>
              <circle className={`banner-tour-map-node-halo${isStartPoint ? ' is-endpoint' : ''}`} r={isStartPoint ? 14 : 11.5} />
              <circle className="banner-tour-map-node-ring" r={isStartPoint ? 9.5 : 8} />
              <circle className={`banner-tour-map-node-core${isStartPoint ? ' is-endpoint' : ''}`} r={isStartPoint ? 3.5 : 2.8} />
              <text
                className="banner-tour-map-label"
                x={labelPlacement.x}
                y={labelPlacement.y}
                textAnchor={labelPlacement.textAnchor}
              >
                {point.code}
              </text>
              {flagCode ? (
                <foreignObject
                  className="banner-tour-map-label-flag"
                  x={labelPlacement.flagX}
                  y={labelPlacement.flagY}
                  width="18"
                  height="13"
                >
                  <div className="banner-tour-map-label-flag-frame">
                    <span className={`fi fi-${flagCode}`} />
                  </div>
                </foreignObject>
              ) : null}
            </g>
          )
        })}

        {showLegend ? (
          <g className="banner-tour-map-legend" transform="translate(44 44)">
            <g transform="translate(0 0)">
              <line className="banner-tour-map-route is-vnws" x1="0" y1="0" x2="32" y2="0" vectorEffect="non-scaling-stroke" />
              <text className="banner-tour-map-legend-label" x="44" y="4">vNWS</text>
            </g>
            <g transform="translate(0 28)">
              <line className="banner-tour-map-route is-rag" x1="0" y1="0" x2="32" y2="0" vectorEffect="non-scaling-stroke" />
              <text className="banner-tour-map-legend-label" x="44" y="4">RAG</text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

function getCommunityCountTypeMeta(locale: Locale, countType: ChallengeCountType) {
  return communityCountTypeLabels[locale][countType]
}

function formatTargetAmount(value: string, locale: Locale) {
  const normalizedValue = value.trim().replace(',', '.')

  if (!normalizedValue) {
    return '0'
  }

  const parsedValue = Number(normalizedValue)

  if (!Number.isFinite(parsedValue)) {
    return value.trim()
  }

  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(parsedValue)
}

function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)
  const [initialStoredSettings] = useState(() => loadStoredBannerSettings(getInitialLocale()))
  const [appMode, setAppMode] = useState<AppMode>(initialStoredSettings.appMode)
  const [eventType, setEventType] = useState<EventType>(() => {
    if (typeof window === 'undefined') {
      return 'focus-airport'
    }

    const storedEventType = window.localStorage.getItem('banner-generator-event-type')

    if (
      storedEventType === 'event' ||
      storedEventType === 'vatsim-region' ||
      storedEventType === 'tour' ||
      storedEventType === 'roster' ||
      storedEventType === 'curated-roster' ||
      storedEventType === 'community-challenge' ||
      storedEventType === 'community-goal'
    ) {
      return storedEventType
    }

    return 'focus-airport'
  })
  const [brandKey, setBrandKey] = useState<BrandKey>(() => {
    if (typeof window === 'undefined') {
      return 'nordwind'
    }

    return window.localStorage.getItem('banner-generator-brand') === 'rag' ? 'rag' : 'nordwind'
  })
  const [form, setForm] = useState<BannerFormState>(initialStoredSettings.form)
  const [badgeForm, setBadgeForm] = useState<BadgeFormState>(initialStoredSettings.badgeForm)
  const [backgroundMode, setBackgroundMode] = useState<'auto' | 'manual'>('auto')
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(defaultBackgroundAsset)
  const [logoOverlayOpacity, setLogoOverlayOpacity] = useState<number>(1)
  const [backgroundInfo, setBackgroundInfo] = useState<BackgroundInfo>({ kind: 'fallback' })
  const [autoBackgroundOptions, setAutoBackgroundOptions] = useState<AutoBackgroundOption[]>([])
  const [favoriteBackgrounds, setFavoriteBackgrounds] = useState<FavoriteBackground[]>(loadFavoriteBackgrounds)
  const [activeFavoriteKey, setActiveFavoriteKey] = useState<string | null>(null)
  const [autoBackgroundRefreshVersion, setAutoBackgroundRefreshVersion] = useState(0)
  const [isApplyingFavoriteBackground, setIsApplyingFavoriteBackground] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isSavingSiteAsset, setIsSavingSiteAsset] = useState(false)
  const [siteAssetMessage, setSiteAssetMessage] = useState('')
  const [siteAssetUrl, setSiteAssetUrl] = useState('')
  const [isAutoSelectingBackground, setIsAutoSelectingBackground] = useState(false)
  const [isSyncingAircraftCatalog, setIsSyncingAircraftCatalog] = useState(false)
  const [aircraftCatalogRefreshVersion, setAircraftCatalogRefreshVersion] = useState(0)
  const [aircraftOptions, setAircraftOptions] = useState<AircraftCatalogItem[]>([])
  const [isLoadingAircraftOptions, setIsLoadingAircraftOptions] = useState(false)
  const [hasLoadedAircraftCatalog, setHasLoadedAircraftCatalog] = useState(false)
  const [aircraftPhotoOptions, setAircraftPhotoOptions] = useState<AircraftPhotoOption[]>([])
  const [isAircraftPhotoListExpanded, setIsAircraftPhotoListExpanded] = useState(false)
  const [isLoadingAircraftPhotos, setIsLoadingAircraftPhotos] = useState(false)
  const [selectedAircraftAirlineFilter, setSelectedAircraftAirlineFilter] = useState('all')
  const [airportOptions, setAirportOptions] = useState<AirportCatalogOption[]>([])
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [archiveItems, setArchiveItems] = useState<CreationGalleryItem[]>([])
  const [archiveError, setArchiveError] = useState('')
  const [previewScale, setPreviewScale] = useState(0.5)
  const [isPreviewPhotoToolsOpen, setIsPreviewPhotoToolsOpen] = useState(false)
  const [isPreviewMapToolsOpen, setIsPreviewMapToolsOpen] = useState(false)
  const [isAircraftPhotoDebugOpen, setIsAircraftPhotoDebugOpen] = useState(false)
  const [vatsimRegionDivisionInput, setVatsimRegionDivisionInput] = useState('')
  const [vatsimRegionPresetInput, setVatsimRegionPresetInput] = useState('')
  const [vatsimRegionFirInput, setVatsimRegionFirInput] = useState('')
  const [activeVatsimRegionDropdown, setActiveVatsimRegionDropdown] = useState<VatsimRegionDropdownTarget | null>(null)
  const [aircraftPhotoLayout, setAircraftPhotoLayout] = useState<AircraftPhotoLayout>(defaultAircraftPhotoLayout)
  const [communityTeams, setCommunityTeams] = useState<CommunityTeam[]>(initialStoredSettings.communityTeams)

  const previewRef = useRef<HTMLDivElement | null>(null)
  const previewViewportRef = useRef<HTMLDivElement | null>(null)
  const vatsimRegionDropdownsRef = useRef<HTMLDivElement | null>(null)
  const aircraftPhotoDragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    rectWidth: number
    rectHeight: number
  } | null>(null)
  const mapDragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
    maxOffsetX: number
    maxOffsetY: number
    rectWidth: number
    rectHeight: number
  } | null>(null)
  const aircraftPhotoResolvedQueryKeyRef = useRef('')
  const aircraftPhotoLastResolvedOptionsRef = useRef<AircraftPhotoOption[]>([])
  const uploadedBackgroundUrlRef = useRef<string | null>(null)
  const prefillAppliedRef = useRef(false)
  const autoBackgroundCacheRef = useRef<Map<string, CachedAutoBackground>>(new Map())
  const favoriteBackgroundAssetUrlsRef = useRef<Map<string, string>>(new Map())
  const aircraftSyncAttemptedSourcesRef = useRef<Set<AircraftSource>>(new Set())
  const previousAircraftBrandKeyRef = useRef<BrandKey>(brandKey)
  const strings = interfaceCopy[locale]
  const bannerStrings = interfaceCopy.en
  const badgeStrings = locale === 'ru'
    ? {
        appTabBanner: 'Banner Generator',
        appTabBadge: 'Badge Generator',
        appTitle: 'Badge Generator',
        appDescription: 'Создавайте бейджи 200×200 за участие в ивентах: подберите форму, цвета, значок и экспортируйте PNG.',
        settingsTitle: 'Badge Settings',
        titleLabel: 'Badge Title',
        subtitleLabel: 'Badge Subtitle',
        topLabel: 'Top Label',
        shapeLabel: 'Badge Shape',
        frameLabel: 'Badge Frame',
        layerStyleLabel: 'Badge Style',
        iconLabel: 'Badge Icon',
        paletteLabel: 'Colors',
        paletteModeLabel: 'Palette Mode',
        paletteModeBrand: 'Brand Default',
        paletteModeCustom: 'Custom',
        paletteModeHelp: 'By default the badge follows the selected project palette. Switch to Custom if you want your own colors.',
        bgColorLabel: 'Background',
        accentColorLabel: 'Accent',
        textColorLabel: 'Text',
        shapeCircle: 'Circle',
        shapeRoundedSquare: 'Rounded Square',
        shapeShield: 'Shield',
        frameRing: 'Ring',
        frameHex: 'Hex',
        frameTicket: 'Ticket',
        layerStyleOrbital: 'Orbital',
        layerStyleWinged: 'Winged',
        layerStyleCrest: 'Crest',
        iconStar: 'Star',
        iconAircraft: 'Aircraft',
        iconJet: 'Jet',
        iconAirliner: 'Airliner',
        iconProp: 'Prop',
        iconHelicopter: 'Helicopter',
        iconRoute: 'Route',
        iconGlobe: 'Globe',
        iconMedal: 'Medal',
        iconCrown: 'Crown',
        iconVatsim: 'VATSIM',
        iconLaurel: 'Laurel',
        previewTitle: 'Badge Preview / 200×200',
        resolutionChip: 'PNG • 1:1',
        exportHelp: 'PNG 200×200. Экспортирует текущий бейдж с выбранной палитрой и значком.',
        exportButton: 'Экспорт PNG',
        exportingButton: 'Экспортируем…',
        exportError: 'Не удалось экспортировать бейдж в PNG.',
      }
    : {
        appTabBanner: 'Banner Generator',
        appTabBadge: 'Badge Generator',
        appTitle: 'Badge Generator',
        appDescription: 'Create 200×200 participation badges: pick a shape, colors, icon, and export a PNG.',
        settingsTitle: 'Badge Settings',
        titleLabel: 'Badge Title',
        subtitleLabel: 'Badge Subtitle',
        topLabel: 'Top Label',
        shapeLabel: 'Badge Shape',
        frameLabel: 'Badge Frame',
        layerStyleLabel: 'Badge Style',
        iconLabel: 'Badge Icon',
        paletteLabel: 'Colors',
        paletteModeLabel: 'Palette Mode',
        paletteModeBrand: 'Brand Default',
        paletteModeCustom: 'Custom',
        paletteModeHelp: 'The badge uses the selected project palette by default. Switch to Custom if you want your own colors.',
        bgColorLabel: 'Background',
        accentColorLabel: 'Accent',
        textColorLabel: 'Text',
        shapeCircle: 'Circle',
        shapeRoundedSquare: 'Rounded Square',
        shapeShield: 'Shield',
        frameRing: 'Ring',
        frameHex: 'Hex',
        frameTicket: 'Ticket',
        layerStyleOrbital: 'Orbital',
        layerStyleWinged: 'Winged',
        layerStyleCrest: 'Crest',
        iconStar: 'Star',
        iconAircraft: 'Aircraft',
        iconJet: 'Jet',
        iconAirliner: 'Airliner',
        iconProp: 'Prop',
        iconHelicopter: 'Helicopter',
        iconRoute: 'Route',
        iconGlobe: 'Globe',
        iconMedal: 'Medal',
        iconCrown: 'Crown',
        iconVatsim: 'VATSIM',
        iconLaurel: 'Laurel',
        previewTitle: 'Badge Preview / 200×200',
        resolutionChip: 'PNG • 1:1',
        exportHelp: 'PNG 200×200. Exports the current badge with the selected palette and icon.',
        exportButton: 'Export PNG',
        exportingButton: 'Exporting…',
        exportError: 'Badge PNG export failed.',
      }
  const guideStrings = guideCopy[locale]
  const activeEvent = eventDefinitions[eventType]
  const bannerActiveEventName = getEventName(eventType, bannerStrings)
  const activeBrand = brandDefinitions[brandKey]
  const activeBrandSource = brandSourceMap[brandKey]
  const activeBadgeBrandPalette = badgeBrandPalettes[brandKey]
  const effectiveBadgePalette = badgeForm.paletteMode === 'brand'
    ? activeBadgeBrandPalette
    : {
        backgroundColor: badgeForm.backgroundColor,
        accentColor: badgeForm.accentColor,
        textColor: badgeForm.textColor,
      }
  const isBadgeMode = appMode === 'badge'
  const previewBaseWidth = isBadgeMode ? 200 : 1920
  const previewBaseHeight = isBadgeMode ? 200 : 1080
  const previewTitleText = isBadgeMode ? badgeStrings.previewTitle : strings.previewTitle
  const previewResolutionChip = isBadgeMode ? badgeStrings.resolutionChip : strings.resolutionChip
  const visualSectionCopy = getVisualSectionCopy(eventType, strings)
  const aircraftFieldConfig = getAircraftFieldConfig(eventType)
  const isBuiltInMapOnlyEvent = isVatsimRegionEvent(eventType) || isComplexEvent(eventType)
  const displayedBackgroundName = getDisplayedBackgroundName(
    backgroundInfo,
    strings,
    isAutoSelectingBackground,
    eventType,
    backgroundMode,
  )
  const displayedLogoName = isComplexEvent(eventType) || isVatsimRegionEvent(eventType)
    ? `${strings.defaultLogoDisplayPrefix}Nordwind Virtual + Russian Airways Group`
    : `${strings.defaultLogoDisplayPrefix}${activeBrand.fullName}`
  const logoAriaLabel = isComplexEvent(eventType) || isVatsimRegionEvent(eventType)
    ? (locale === 'ru' ? 'Логотипы vNWS и RAG' : 'vNWS and RAG logos')
    : `${activeBrand.fullName} ${strings.logoAriaLabel.toLowerCase()}`
  const selectedAutoBackgroundOption =
    autoBackgroundOptions.find((option) => option.objectUrl === backgroundUrl) ??
    autoBackgroundOptions.find((option) => backgroundInfo.kind === 'auto' && option.label === backgroundInfo.label) ??
    null
  const isFavoriteBackgroundSaved = !!selectedAutoBackgroundOption?.sourceUrl && favoriteBackgrounds.some(
    (favoriteBackground) => favoriteBackground.sourceUrl === selectedAutoBackgroundOption.sourceUrl,
  )
  const currentSearchKey = getAutoBackgroundSearchKey(form, eventType, brandKey)
  const activeAircraftSearch = aircraftFieldConfig ? form[aircraftFieldConfig.searchField].trim() : ''
  const activeAircraftEnabled = aircraftFieldConfig ? form[aircraftFieldConfig.enabledField] : false
  const activeAircraftSource: AircraftSource = activeBrandSource
  const activeAircraftId = aircraftFieldConfig ? form[aircraftFieldConfig.idField].trim() : ''
  const activeAircraftName = aircraftFieldConfig ? form[aircraftFieldConfig.nameField].trim() : ''
  const activeAircraftRegistration = aircraftFieldConfig ? form[aircraftFieldConfig.registrationField].trim().toUpperCase() : ''
  const activeAircraftPhotoUrl = aircraftFieldConfig ? form[aircraftFieldConfig.photoUrlField].trim() : ''
  const activeAircraftPhotoAttribution = aircraftFieldConfig ? form[aircraftFieldConfig.photoAttributionField].trim() : ''
  const activeAircraftPhotoLinkback = aircraftFieldConfig ? form[aircraftFieldConfig.photoLinkbackField].trim() : ''
  const activeAircraftPhotoOffsetX = aircraftFieldConfig ? clampNumber(Number(form[aircraftFieldConfig.photoOffsetXField]) || 0, -30, 30) : 0
  const activeAircraftPhotoOffsetY = aircraftFieldConfig ? clampNumber(Number(form[aircraftFieldConfig.photoOffsetYField]) || 0, -30, 30) : 0
  const activeAircraftPhotoZoom = aircraftFieldConfig ? clampNumber(Number(form[aircraftFieldConfig.photoZoomField]) || 100, 70, 170) : 100
  const activeAircraftSourceLabel = getAircraftSourceLabel(activeAircraftSource)
  const isAircraftTypeDropdownMode = eventType === 'curated-roster' || eventType === 'roster'
  const aircraftCatalogQuery = isAircraftTypeDropdownMode ? '' : activeAircraftSearch
  const availableAircraftAirlineFilters = ['all', ...Array.from(new Set(aircraftOptions.map(getAircraftAirlineLabel))).sort((left, right) => left.localeCompare(right))]
  const filteredAircraftOptions = selectedAircraftAirlineFilter === 'all'
    ? aircraftOptions
    : aircraftOptions.filter((option) => getAircraftAirlineLabel(option) === selectedAircraftAirlineFilter)
  const selectedAircraftRecord = aircraftOptions.find((option) => (
    option.source === activeAircraftSource && (
      (activeAircraftId && option.aircraft_id === Number(activeAircraftId)) ||
      (activeAircraftRegistration && option.registration === activeAircraftRegistration)
    )
  ))
  const selectedAircraftTypeValue = selectedAircraftRecord
    ? getAircraftTypeLabel(selectedAircraftRecord)
    : activeAircraftName
  const availableAircraftTypeOptions = Array.from(
    new Set(filteredAircraftOptions.map(getAircraftTypeLabel).filter((label) => Boolean(label.trim()))),
  ).sort((left, right) => left.localeCompare(right))
  const filteredAircraftRegistrationOptions = selectedAircraftTypeValue
    ? filteredAircraftOptions.filter((option) => getAircraftTypeLabel(option) === selectedAircraftTypeValue)
    : []
  const selectedAircraftRegistrationKey = filteredAircraftRegistrationOptions.find((option) => (
    option.source === activeAircraftSource && option.registration === activeAircraftRegistration
  ))
    ? `${activeAircraftSource}:${activeAircraftRegistration}`
    : ''
  const representativeAircraftOption = selectedAircraftTypeValue
    ? filteredAircraftOptions.find((option) => getAircraftTypeLabel(option) === selectedAircraftTypeValue) ?? null
    : null
  const effectiveAircraftPhotoLayout = buildAircraftPhotoLayout(
    aircraftPhotoLayout,
    activeAircraftPhotoOffsetX,
    activeAircraftPhotoOffsetY,
    activeAircraftPhotoZoom,
  )

  useEffect(() => {
    if (!activeAircraftPhotoUrl) {
      setAircraftPhotoLayout(defaultAircraftPhotoLayout)
      return
    }

    let ignoreResult = false
    const probeImage = new Image()

    probeImage.decoding = 'async'
    probeImage.onload = () => {
      if (!ignoreResult) {
        setAircraftPhotoLayout(getAircraftPhotoLayout(probeImage.naturalWidth, probeImage.naturalHeight))
      }
    }
    probeImage.onerror = () => {
      if (!ignoreResult) {
        setAircraftPhotoLayout(defaultAircraftPhotoLayout)
      }
    }
    probeImage.src = activeAircraftPhotoUrl

    return () => {
      ignoreResult = true
    }
  }, [activeAircraftPhotoUrl])

  useEffect(() => {
    return () => {
      if (uploadedBackgroundUrlRef.current) {
        URL.revokeObjectURL(uploadedBackgroundUrlRef.current)
      }

      for (const cachedBackground of autoBackgroundCacheRef.current.values()) {
        for (const option of cachedBackground.options) {
          URL.revokeObjectURL(option.objectUrl)
        }
      }

      for (const cachedObjectUrl of favoriteBackgroundAssetUrlsRef.current.values()) {
        URL.revokeObjectURL(cachedObjectUrl)
      }
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(favoriteBackgroundsStorageKey, JSON.stringify(favoriteBackgrounds))
  }, [favoriteBackgrounds])

  useEffect(() => {
    document.documentElement.lang = locale
    window.localStorage.setItem('banner-generator-locale', locale)
  }, [locale])

  useEffect(() => {
    window.localStorage.removeItem('banner-generator-banner-locale')
  }, [])

  useEffect(() => {
    window.localStorage.setItem('banner-generator-event-type', eventType)
  }, [eventType])

  useEffect(() => {
    window.localStorage.setItem('banner-generator-brand', brandKey)
  }, [brandKey])

  useEffect(() => {
    if (typeof window === 'undefined' || prefillAppliedRef.current) {
      return
    }

    prefillAppliedRef.current = true

    const params = new URLSearchParams(window.location.search)
    if ([...params.keys()].length === 0) {
      return
    }

    const title = params.get('title')?.trim() ?? ''
    const category = params.get('category')?.trim() ?? ''
    const type = params.get('type')?.trim() ?? ''
    const tag = params.get('tag')?.trim() ?? ''
    const summary = params.get('summary')?.trim() ?? ''
    const target = params.get('target')?.trim() ?? ''
    const author = params.get('author')?.trim() ?? ''
    const inferredIcao = parseIcaoCandidate(target, tag, title, summary)
    const nextEventType = inferPrefillEventType(category, type, tag, target)

    if ((params.get('brand') || '').toLowerCase().includes('rag')) {
      setBrandKey('rag')
    }

    setEventType(nextEventType)
    setForm((current) => ({
      ...current,
      city: title || current.city,
      airportName: target || tag || author || current.airportName,
      icao: inferredIcao || current.icao,
      complexEventTitle: nextEventType === 'event' && title ? title : current.complexEventTitle,
      complexEventDescription: nextEventType === 'event' && summary ? summary : current.complexEventDescription,
      vatsimRegionTitle: nextEventType === 'vatsim-region' && title ? title : current.vatsimRegionTitle,
      vatsimRegionDescription: nextEventType === 'vatsim-region' && summary ? summary : current.vatsimRegionDescription,
      tourTitle: nextEventType === 'tour' && title ? title : current.tourTitle,
      tourDescription: nextEventType === 'tour' && summary ? summary : current.tourDescription,
      rosterTitle: nextEventType === 'roster' && title ? title : current.rosterTitle,
      rosterDescription: nextEventType === 'roster' && summary ? summary : current.rosterDescription,
      curatedRosterTitle: nextEventType === 'curated-roster' && title ? title : current.curatedRosterTitle,
      curatedRosterDescription: nextEventType === 'curated-roster' && summary ? summary : current.curatedRosterDescription,
      challengeName: nextEventType === 'community-challenge' && title ? title : current.challengeName,
      communityGoalName: nextEventType === 'community-goal' && title ? title : current.communityGoalName,
      communityGoalDescription: nextEventType === 'community-goal' && summary ? summary : current.communityGoalDescription,
    }))
  }, [])

  useEffect(() => {
    window.localStorage.setItem('banner-generator-app-mode', appMode)
  }, [appMode])

  useEffect(() => {
    const aircraftBrandChanged = previousAircraftBrandKeyRef.current !== brandKey
    previousAircraftBrandKeyRef.current = brandKey

    const currentAircraftFieldConfig = getAircraftFieldConfig(eventType)

    if (!currentAircraftFieldConfig) {
      return
    }

    setForm((current) => {
      const storedAircraftSource = current[currentAircraftFieldConfig.sourceField].trim().toLowerCase()
      const sourceMismatch = storedAircraftSource !== '' && storedAircraftSource !== activeAircraftSource

      if (!aircraftBrandChanged && !sourceMismatch) {
        return current
      }

      return {
        ...current,
        [currentAircraftFieldConfig.searchField]: '',
        [currentAircraftFieldConfig.sourceField]: activeAircraftSource,
        [currentAircraftFieldConfig.idField]: '',
        [currentAircraftFieldConfig.nameField]: '',
        [currentAircraftFieldConfig.registrationField]: '',
        [currentAircraftFieldConfig.photoUrlField]: '',
        [currentAircraftFieldConfig.photoAttributionField]: '',
        [currentAircraftFieldConfig.photoLinkbackField]: '',
      }
    })

    if (aircraftBrandChanged) {
      setAircraftOptions([])
      setAircraftPhotoOptions([])
      setHasLoadedAircraftCatalog(false)
    }
  }, [activeAircraftSource, brandKey, eventType])

  useEffect(() => {
    const storedSettings: StoredBannerSettings = {
      appMode,
      form,
      badgeForm,
      communityTeams,
    }

    window.localStorage.setItem(bannerSettingsStorageKey, JSON.stringify(storedSettings))
  }, [appMode, badgeForm, form, communityTeams])

  useEffect(() => {
    if (!aircraftFieldConfig || !activeAircraftEnabled) {
      setAircraftOptions([])
      setAircraftPhotoOptions([])
      setIsSyncingAircraftCatalog(false)
      setHasLoadedAircraftCatalog(false)
      return
    }

    if (!autoSyncAircraftCatalog) {
      setIsSyncingAircraftCatalog(false)
      return
    }

    if (!hasLoadedAircraftCatalog || isLoadingAircraftOptions || aircraftOptions.length > 0) {
      return
    }

    const sourcesToSync = aircraftSyncAttemptedSourcesRef.current.has(activeAircraftSource)
      ? []
      : [activeAircraftSource]

    if (sourcesToSync.length === 0) {
      return
    }

    for (const source of sourcesToSync) {
      aircraftSyncAttemptedSourcesRef.current.add(source)
    }

    let ignoreResult = false

    void (async () => {
      setIsSyncingAircraftCatalog(true)

      try {
        await syncAircraftCatalogs(sourcesToSync)
        setErrorMessage('')
        setAircraftCatalogRefreshVersion((current) => current + 1)
      } catch {
        if (!ignoreResult) {
          setAircraftOptions([])
          setErrorMessage(
            locale === 'ru'
              ? `Не удалось синхронизировать самолёты ${activeAircraftSourceLabel}. Проверьте vAMSYS credentials на backend.`
              : `Failed to sync ${activeAircraftSourceLabel} aircraft. Check the backend vAMSYS credentials.`,
          )
        }
      } finally {
        if (!ignoreResult) {
          setIsSyncingAircraftCatalog(false)
        }
      }
    })()

    return () => {
      ignoreResult = true
    }
  }, [
    activeAircraftEnabled,
    activeAircraftSource,
    activeAircraftSourceLabel,
    aircraftFieldConfig,
    aircraftOptions.length,
    hasLoadedAircraftCatalog,
    eventType,
    isLoadingAircraftOptions,
    locale,
  ])

  useEffect(() => {
    if (!aircraftFieldConfig || !activeAircraftEnabled) {
      setAircraftOptions([])
      setHasLoadedAircraftCatalog(false)
      setIsLoadingAircraftOptions(false)
      return
    }

    if (isAircraftTypeDropdownMode) {
      setAircraftOptions(getBundledAircraftCatalog(activeAircraftSource, aircraftCatalogQuery, 2000))
      setHasLoadedAircraftCatalog(true)
      setIsLoadingAircraftOptions(false)
      return
    }

    const controller = new AbortController()
    let ignoreResult = false

    const timeoutId = window.setTimeout(async () => {
      setIsLoadingAircraftOptions(true)

      try {
        const items = await fetchAircraftCatalog(
          aircraftCatalogQuery,
          [activeAircraftSource],
          controller.signal,
          aircraftCatalogQuery ? 160 : 2000,
        )

        if (!ignoreResult) {
          setAircraftOptions(items)
        }
      } catch {
        if (!ignoreResult && !controller.signal.aborted) {
          setAircraftOptions([])
        }
      } finally {
        if (!ignoreResult) {
          setIsLoadingAircraftOptions(false)
          setHasLoadedAircraftCatalog(true)
        }
      }
    }, 220)

    return () => {
      ignoreResult = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [
    activeAircraftSource,
    activeAircraftEnabled,
    aircraftCatalogQuery,
    aircraftCatalogRefreshVersion,
    aircraftFieldConfig,
    eventType,
    isAircraftTypeDropdownMode,
  ])

  useEffect(() => {
    setSelectedAircraftAirlineFilter('all')
  }, [activeAircraftSource, eventType])

  useEffect(() => {
    if (!availableAircraftAirlineFilters.includes(selectedAircraftAirlineFilter)) {
      setSelectedAircraftAirlineFilter('all')
    }
  }, [availableAircraftAirlineFilters, selectedAircraftAirlineFilter])

  async function loadAircraftPhotoOptionsForAircraft(option: {
    source: AircraftSource
    aircraftId?: string
    registration: string
    typeQuery: string
    displayTypeQuery?: string
    localPhotoOption?: AircraftPhotoOption | null
  }) {
    const steps = getAircraftPhotoSearchSteps(eventType, option.registration, option.typeQuery)
    let photoItems: AircraftPhotoOption[] = option.localPhotoOption ? [option.localPhotoOption] : []

    for (const step of steps) {
      if (step === 'registration') {
        const registrationItems = await loadRegistrationPhotoOptionsWithFallback(option.registration, option.source, option.aircraftId)
        photoItems = mergeAircraftPhotoOptions(photoItems, registrationItems)
        continue
      }

      const typeItems = await loadTypePhotoOptionsWithFallback(
        option.typeQuery,
        option.source,
        option.aircraftId,
        option.displayTypeQuery,
      )
      photoItems = mergeAircraftPhotoOptions(photoItems, typeItems)
    }

    return photoItems
  }

  useEffect(() => {
    const registrationQuery = activeAircraftRegistration
    const typeQuery = activeAircraftName
    const requestKey = `${eventType}|${activeAircraftSource}|${activeAircraftId}|${registrationQuery}|${typeQuery}`

    if (!aircraftFieldConfig || !activeAircraftEnabled || (!registrationQuery && !typeQuery)) {
      setAircraftPhotoOptions([])
      setIsAircraftPhotoListExpanded(false)
      aircraftPhotoResolvedQueryKeyRef.current = ''
      aircraftPhotoLastResolvedOptionsRef.current = []
      return
    }

    let ignoreResult = false

    void (async () => {
      setIsLoadingAircraftPhotos(true)

      const localPhotoOption = toLocalAircraftPhotoOption(selectedAircraftRecord ?? representativeAircraftOption)

      try {
        const photoItems = await loadAircraftPhotoOptionsForAircraft({
          source: activeAircraftSource,
          aircraftId: activeAircraftId,
          registration: registrationQuery,
          typeQuery,
          displayTypeQuery: selectedAircraftRecord ? getAircraftDisplayTypeLabel(selectedAircraftRecord) : representativeAircraftOption ? getAircraftDisplayTypeLabel(representativeAircraftOption) : typeQuery,
          localPhotoOption,
        })
        const resolvedPhotoItems = photoItems.length > 0
          ? photoItems
          : (
            aircraftPhotoResolvedQueryKeyRef.current === requestKey && aircraftPhotoLastResolvedOptionsRef.current.length > 0
              ? aircraftPhotoLastResolvedOptionsRef.current
              : (localPhotoOption ? [localPhotoOption] : [])
          )

        if (!ignoreResult) {
          setAircraftPhotoOptions(resolvedPhotoItems)
          setIsAircraftPhotoListExpanded(false)
          aircraftPhotoResolvedQueryKeyRef.current = requestKey

          if (resolvedPhotoItems.length > 0) {
            aircraftPhotoLastResolvedOptionsRef.current = resolvedPhotoItems
            const selectedPhoto = resolvedPhotoItems.find((item) => item.image_url === activeAircraftPhotoUrl) ?? resolvedPhotoItems[0]

            updateField(aircraftFieldConfig.photoUrlField, selectedPhoto.image_url)
            updateField(aircraftFieldConfig.photoAttributionField, selectedPhoto.attribution ?? '')
            updateField(aircraftFieldConfig.photoLinkbackField, selectedPhoto.linkback ?? '')
          }
        }
      } catch {
        if (!ignoreResult) {
          setAircraftPhotoOptions((current) => (
            aircraftPhotoResolvedQueryKeyRef.current === requestKey && current.length > 0
              ? current
              : (localPhotoOption ? [localPhotoOption] : [])
          ))
        }
      } finally {
        if (!ignoreResult) {
          setIsLoadingAircraftPhotos(false)
        }
      }
    })()

    return () => {
      ignoreResult = true
    }
  }, [
    activeAircraftEnabled,
    activeAircraftId,
    activeAircraftName,
    activeAircraftPhotoUrl,
    activeAircraftRegistration,
    activeAircraftSource,
    eventType,
    representativeAircraftOption,
    selectedAircraftRecord,
  ])

  useEffect(() => {
    if (!aircraftFieldConfig || !activeAircraftEnabled || aircraftPhotoOptions.length === 0) {
      return
    }

    const activePhotoStillExists = aircraftPhotoOptions.some((item) => item.image_url === activeAircraftPhotoUrl)

    if (activePhotoStillExists) {
      return
    }

    const fallbackPhoto = aircraftPhotoOptions[0]

    if (!fallbackPhoto) {
      return
    }

    updateField(aircraftFieldConfig.photoUrlField, fallbackPhoto.image_url)
    updateField(aircraftFieldConfig.photoAttributionField, fallbackPhoto.attribution ?? '')
    updateField(aircraftFieldConfig.photoLinkbackField, fallbackPhoto.linkback ?? '')
  }, [
    activeAircraftEnabled,
    activeAircraftPhotoUrl,
    aircraftFieldConfig,
    aircraftPhotoOptions,
  ])

  useEffect(() => {
    if (!activeAircraftPhotoUrl) {
      setIsPreviewPhotoToolsOpen(false)
    }
  }, [activeAircraftPhotoUrl])

  useEffect(() => {
    if (!isArchiveOpen) {
      return
    }

    let ignoreResult = false
    setArchiveError('')

    void (async () => {
      try {
        const items = await fetchCreationArchive()

        if (!ignoreResult) {
          setArchiveItems(items)
        }
      } catch {
        if (!ignoreResult) {
          setArchiveItems([])
          setArchiveError(guideStrings.archiveLoadError)
        }
      }
    })()

    return () => {
      ignoreResult = true
    }
  }, [isArchiveOpen, guideStrings.archiveLoadError])

  useLayoutEffect(() => {
    const viewport = previewViewportRef.current

    if (!viewport) {
      return
    }

    const updatePreviewScale = () => {
      const viewportWidth = viewport.clientWidth

      if (!viewportWidth) {
        return
      }

      setPreviewScale(Math.min(1, viewportWidth / previewBaseWidth))
    }

    updatePreviewScale()

    const resizeObserver = new ResizeObserver(() => updatePreviewScale())
    resizeObserver.observe(viewport)

    return () => {
      resizeObserver.disconnect()
    }
  }, [previewBaseWidth])

  useEffect(() => {
    if (backgroundMode !== 'auto') {
      return
    }

    if (eventType !== 'focus-airport') {
      setAutoBackgroundOptions([])
      setBackgroundUrl(null)
      setBackgroundInfo({ kind: 'fallback' })
      setIsAutoSelectingBackground(false)
      return
    }

    const searchKey = getAutoBackgroundSearchKey(form, eventType, brandKey)
    const cachedBackground = autoBackgroundCacheRef.current.get(searchKey)

    if (cachedBackground) {
      setAutoBackgroundOptions(cachedBackground.options)

      const selectedOption = cachedBackground.options[0]

      if (selectedOption) {
        setBackgroundUrl(selectedOption.objectUrl)
        setBackgroundInfo({ kind: 'auto', label: selectedOption.label })
      } else {
        setBackgroundUrl(defaultBackgroundAsset)
        setBackgroundInfo({ kind: 'auto-empty' })
      }

      setIsAutoSelectingBackground(false)
      return
    }

    const controller = new AbortController()
    let ignoreResult = false

    const timeoutId = window.setTimeout(async () => {
      setIsAutoSelectingBackground(true)

      try {
        const candidates = await fetchAutoBackgroundCandidates(form, brandKey, controller.signal)

        if (candidates.length === 0) {
          if (!ignoreResult) {
            setAutoBackgroundOptions([])
            setBackgroundUrl(defaultBackgroundAsset)
            setBackgroundInfo({ kind: 'auto-empty' })
          }

          return
        }

        const optionResults = await Promise.allSettled(
          candidates.map(async (candidate) => {
            const imageResponse = await fetch(candidate.thumbUrl, { mode: 'cors', signal: controller.signal })

            if (!imageResponse.ok) {
              throw new Error('Auto background image request failed')
            }

            const imageBlob = await imageResponse.blob()

            return {
              key: slugify(candidate.title) || candidate.title,
              objectUrl: URL.createObjectURL(imageBlob),
              label: cleanWikimediaTitle(candidate.title),
              sourceUrl: candidate.thumbUrl,
            }
          }),
        )

        const options = optionResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))

        if (options.length === 0) {
          throw new Error('No usable auto background options were loaded')
        }

        autoBackgroundCacheRef.current.set(searchKey, {
          options,
        })

        if (!ignoreResult) {
          setAutoBackgroundOptions(options)
          setBackgroundUrl(options[0].objectUrl)
          setBackgroundInfo({ kind: 'auto', label: options[0].label })
          setActiveFavoriteKey(null)
        }
      } catch {
        if (!ignoreResult && !controller.signal.aborted) {
          setAutoBackgroundOptions([])
          setBackgroundUrl(defaultBackgroundAsset)
          setBackgroundInfo({ kind: 'auto-error' })
        }
      } finally {
        if (!ignoreResult) {
          setIsAutoSelectingBackground(false)
        }
      }
    }, 420)

    return () => {
      ignoreResult = true
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [backgroundMode, eventType, brandKey, form.airportName, form.city, form.countryCode, autoBackgroundRefreshVersion])

  useEffect(() => {
    if (!isBuiltInMapOnlyEvent || backgroundMode === 'auto') {
      return
    }

    if (uploadedBackgroundUrlRef.current) {
      URL.revokeObjectURL(uploadedBackgroundUrlRef.current)
      uploadedBackgroundUrlRef.current = null
    }

    setBackgroundMode('auto')
    setBackgroundUrl(null)
    setBackgroundInfo({ kind: 'fallback' })
    setActiveFavoriteKey(null)
  }, [backgroundMode, isBuiltInMapOnlyEvent])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (vatsimRegionDropdownsRef.current && !vatsimRegionDropdownsRef.current.contains(target)) {
        setActiveVatsimRegionDropdown(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    const currentDivisionIds = parseSerializedSelection(form.vatsimRegionDivisionSelection)
    const currentAvailablePresetIds = getPresetDefinitionsForDivisions(currentDivisionIds).map((preset) => preset.id)
    const currentPresetIds = normalizeVatsimRegionPresetIds(
      parseSerializedSelection(form.vatsimRegionPresetSelection),
      currentAvailablePresetIds,
    )
    const currentAvailableFirIds = getPresetFirIds(currentPresetIds).filter((firId) => vatspyTopLevelBoundaryOverlayById.has(firId))

    if (activeVatsimRegionDropdown === 'preset' && currentAvailablePresetIds.length === 0) {
      setActiveVatsimRegionDropdown(null)
    }

    if (activeVatsimRegionDropdown === 'fir' && currentAvailableFirIds.length === 0) {
      setActiveVatsimRegionDropdown(null)
    }
  }, [activeVatsimRegionDropdown, form.vatsimRegionDivisionSelection, form.vatsimRegionPresetSelection])

  function updateField<K extends keyof BannerFormState>(field: K, value: BannerFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateBadgeField<K extends keyof BadgeFormState>(field: K, value: BadgeFormState[K]) {
    setBadgeForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleVatsimRegionSelectionInputKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
    commitSelection: () => void,
  ) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault()
      commitSelection()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      return
    }

    if (event.key === 'Escape') {
      setActiveVatsimRegionDropdown(null)
    }
  }

  function toggleVatsimRegionDropdown(target: VatsimRegionDropdownTarget) {
    setActiveVatsimRegionDropdown((current) => current === target ? null : target)
  }

  function appendVatsimRegionDivisionSelection(divisionIds: string[]) {
    if (divisionIds.length === 0) {
      return false
    }

    setForm((current) => buildVatsimRegionSelectionState(current, {
      divisionIds: [...parseSerializedSelection(current.vatsimRegionDivisionSelection), ...divisionIds],
    }))
    setVatsimRegionDivisionInput('')
    setActiveVatsimRegionDropdown(null)
    return true
  }

  function appendVatsimRegionPresetSelection(presetIds: string[]) {
    if (presetIds.length === 0) {
      return false
    }

    setForm((current) => buildVatsimRegionSelectionState(current, {
      presetIds: [...parseSerializedSelection(current.vatsimRegionPresetSelection), ...presetIds],
    }))
    setVatsimRegionPresetInput('')
    setActiveVatsimRegionDropdown(null)
    return true
  }

  function appendVatsimRegionFirSelection(firIds: string[]) {
    if (firIds.length === 0) {
      return false
    }

    setForm((current) => {
      const currentDivisionIds = parseSerializedSelection(current.vatsimRegionDivisionSelection)
      const availablePresetIds = getPresetDefinitionsForDivisions(currentDivisionIds).map((preset) => preset.id)
      const currentPresetIds = normalizeVatsimRegionPresetIds(
        parseSerializedSelection(current.vatsimRegionPresetSelection),
        availablePresetIds,
      )
      const currentExplicitFirIds = parseSerializedSelection(current.vatsimRegionFirSelection)

      return buildVatsimRegionSelectionState(current, {
        presetIds: currentPresetIds,
        firIds: [...currentExplicitFirIds, ...firIds],
      })
    })
    setVatsimRegionFirInput('')
    setActiveVatsimRegionDropdown(null)
    return true
  }

  function commitVatsimRegionDivisionInput(options: VatsimRegionSelectionOption[]) {
    const resolvedDivisionIds = resolveVatsimRegionSelectionInput(vatsimRegionDivisionInput, options)

    return appendVatsimRegionDivisionSelection(resolvedDivisionIds)
  }

  function commitVatsimRegionPresetInput(options: VatsimRegionSelectionOption[]) {
    const resolvedPresetIds = resolveVatsimRegionSelectionInput(vatsimRegionPresetInput, options)

    return appendVatsimRegionPresetSelection(resolvedPresetIds)
  }

  function commitVatsimRegionFirInput(options: VatsimRegionSelectionOption[]) {
    const resolvedFirIds = resolveVatsimRegionSelectionInput(vatsimRegionFirInput, options)

    return appendVatsimRegionFirSelection(resolvedFirIds)
  }

  function resetAircraftPhotoFraming() {
    if (!aircraftFieldConfig) {
      return
    }

    updateField(aircraftFieldConfig.photoOffsetXField, '0')
    updateField(aircraftFieldConfig.photoOffsetYField, '0')
    updateField(aircraftFieldConfig.photoZoomField, '100')
  }

  function resetMapView() {
    updateField('mapZoom', '100')
    updateField('mapOffsetX', '0')
    updateField('mapOffsetY', '0')
  }

  function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShowPreviewMapTools) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()

    mapDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: activeMapOffsetX,
      startOffsetY: activeMapOffsetY,
      maxOffsetX: activeMapPanLimits.maxOffsetX,
      maxOffsetY: activeMapPanLimits.maxOffsetY,
      rectWidth: rect.width,
      rectHeight: rect.height,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleMapPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = mapDragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const scaleX = tourMapViewBox.width / Math.max(dragState.rectWidth, 1)
    const scaleY = tourMapViewBox.height / Math.max(dragState.rectHeight, 1)
    const nextOffsetX = clampNumber(
      dragState.startOffsetX + (event.clientX - dragState.startX) * scaleX,
      -dragState.maxOffsetX,
      dragState.maxOffsetX,
    )
    const nextOffsetY = clampNumber(
      dragState.startOffsetY + (event.clientY - dragState.startY) * scaleY,
      -dragState.maxOffsetY,
      dragState.maxOffsetY,
    )

    updateField('mapOffsetX', String(Number(nextOffsetX.toFixed(2))))
    updateField('mapOffsetY', String(Number(nextOffsetY.toFixed(2))))
    event.preventDefault()
  }

  function handleMapPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = mapDragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    mapDragStateRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function updateAirportFields(option: AirportCatalogOption) {
    const values = applyAirportOptionToForm(option)

    setForm((current) => ({
      ...current,
      city: values.city,
      countryCode: values.countryCode || current.countryCode,
      icao: values.icao,
      airportName: values.airportName,
    }))
    setAirportOptions([])
  }

  function handleCityChange(value: string) {
    updateField('city', value)
    setAirportOptions(findAirportOptionsByCity(value))
  }

  function handleIcaoChange(value: string) {
    const normalizedValue = value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4)
    const airport = airportByIcaoLookup.get(normalizedValue)

    if (airport) {
      updateAirportFields(airport)
      return
    }

    updateField('icao', normalizedValue)
    setAirportOptions([])
  }

  function toggleAircraftAssignment(enabled: boolean) {
    if (!aircraftFieldConfig) {
      return
    }

    updateField(aircraftFieldConfig.enabledField, enabled)
    updateField(aircraftFieldConfig.sourceField, activeAircraftSource)

    if (!enabled) {
      updateField(aircraftFieldConfig.searchField, '')
      updateField(aircraftFieldConfig.idField, '')
      updateField(aircraftFieldConfig.nameField, '')
      updateField(aircraftFieldConfig.registrationField, '')
      updateField(aircraftFieldConfig.photoUrlField, '')
      updateField(aircraftFieldConfig.photoAttributionField, '')
      updateField(aircraftFieldConfig.photoLinkbackField, '')
      updateField(aircraftFieldConfig.photoManualField, false)
      updateField(aircraftFieldConfig.photoOffsetXField, '0')
      updateField(aircraftFieldConfig.photoOffsetYField, '0')
      updateField(aircraftFieldConfig.photoZoomField, '100')
      setAircraftOptions([])
      setAircraftPhotoOptions([])
    }
  }

  function selectAircraftOption(option: AircraftCatalogItem) {
    if (!aircraftFieldConfig) {
      return
    }

    const aircraftType = getAircraftTypeLabel(option) || getAircraftDisplayTypeLabel(option)

    updateField(aircraftFieldConfig.sourceField, option.source)
    updateField(aircraftFieldConfig.idField, option.aircraft_id ? String(option.aircraft_id) : '')
    updateField(aircraftFieldConfig.nameField, isAircraftTypeDropdownMode ? aircraftType : option.name)
    updateField(aircraftFieldConfig.registrationField, option.registration)
    updateField(aircraftFieldConfig.photoUrlField, option.image_url ?? '')
    updateField(aircraftFieldConfig.photoAttributionField, option.image_attribution ?? '')
    updateField(aircraftFieldConfig.photoLinkbackField, option.image_linkback ?? '')
  }

  function handleAircraftAirlineChange(value: string) {
    setSelectedAircraftAirlineFilter(value)

    if (!aircraftFieldConfig) {
      return
    }

    updateField(aircraftFieldConfig.idField, '')
    updateField(aircraftFieldConfig.nameField, '')
    updateField(aircraftFieldConfig.registrationField, '')
    updateField(aircraftFieldConfig.photoUrlField, '')
    updateField(aircraftFieldConfig.photoAttributionField, '')
    updateField(aircraftFieldConfig.photoLinkbackField, '')
  }

  function handleAircraftTypeChange(value: string) {
    if (!aircraftFieldConfig) {
      return
    }

    const normalizedType = value.trim().toUpperCase()

    updateField(aircraftFieldConfig.nameField, normalizedType)
    updateField(aircraftFieldConfig.registrationField, '')

    const representativeOption = filteredAircraftOptions.find((option) => getAircraftTypeLabel(option) === normalizedType)

    updateField(aircraftFieldConfig.sourceField, representativeOption?.source ?? activeAircraftSource)
    updateField(aircraftFieldConfig.idField, representativeOption?.aircraft_id ? String(representativeOption.aircraft_id) : '')
    updateField(aircraftFieldConfig.photoUrlField, representativeOption?.image_url ?? '')
    updateField(aircraftFieldConfig.photoAttributionField, representativeOption?.image_attribution ?? '')
    updateField(aircraftFieldConfig.photoLinkbackField, representativeOption?.image_linkback ?? '')

    if ((eventType === 'curated-roster' || eventType === 'roster') && representativeOption) {
      void preloadAircraftPhotoOptions(representativeOption)
    }
  }

  function handleAircraftRegistrationChange(value: string) {
    if (!aircraftFieldConfig) {
      return
    }

    if (!value) {
      updateField(aircraftFieldConfig.idField, '')
      updateField(aircraftFieldConfig.registrationField, '')
      return
    }

    const selectedOption = filteredAircraftRegistrationOptions.find((option) => `${option.source}:${option.registration}` === value)

    if (!selectedOption) {
      return
    }

    selectAircraftOption(selectedOption)
    void preloadAircraftPhotoOptions(selectedOption)
  }

  async function preloadAircraftPhotoOptions(option: AircraftCatalogItem) {
    if (!aircraftFieldConfig || !activeAircraftEnabled) {
      return
    }

    const registrationQuery = option.registration.trim().toUpperCase()
    const typeQuery = (getAircraftTypeLabel(option) || getAircraftDisplayTypeLabel(option)).trim()
    const requestKey = `${eventType}|${option.source}|${option.aircraft_id ? String(option.aircraft_id) : ''}|${registrationQuery}|${typeQuery}`
    const localPhotoOption = toLocalAircraftPhotoOption(option)

      setIsLoadingAircraftPhotos(true)

    try {
      const photoItems = await loadAircraftPhotoOptionsForAircraft({
        source: option.source as AircraftSource,
        aircraftId: option.aircraft_id ? String(option.aircraft_id) : '',
        registration: registrationQuery,
        typeQuery,
        displayTypeQuery: getAircraftDisplayTypeLabel(option),
        localPhotoOption,
      })
      const resolvedPhotoItems = photoItems.length > 0
        ? photoItems
        : (
          aircraftPhotoResolvedQueryKeyRef.current === requestKey && aircraftPhotoLastResolvedOptionsRef.current.length > 0
            ? aircraftPhotoLastResolvedOptionsRef.current
            : (localPhotoOption ? [localPhotoOption] : [])
        )

      setAircraftPhotoOptions(resolvedPhotoItems)
      setIsAircraftPhotoListExpanded(false)
      aircraftPhotoResolvedQueryKeyRef.current = requestKey

      if (resolvedPhotoItems.length > 0) {
        aircraftPhotoLastResolvedOptionsRef.current = resolvedPhotoItems
        const selectedPhoto = resolvedPhotoItems[0]
        updateField(aircraftFieldConfig.photoUrlField, selectedPhoto.image_url)
        updateField(aircraftFieldConfig.photoAttributionField, selectedPhoto.attribution ?? '')
        updateField(aircraftFieldConfig.photoLinkbackField, selectedPhoto.linkback ?? '')
      }
    } catch {
      setAircraftPhotoOptions((current) => (
        aircraftPhotoResolvedQueryKeyRef.current === requestKey && current.length > 0
          ? current
          : (localPhotoOption ? [localPhotoOption] : [])
      ))
    } finally {
      setIsLoadingAircraftPhotos(false)
    }
  }

  function handleAircraftPhotoPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!aircraftFieldConfig || !activeAircraftPhotoUrl) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()

    aircraftPhotoDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: activeAircraftPhotoOffsetX,
      startOffsetY: activeAircraftPhotoOffsetY,
      rectWidth: rect.width,
      rectHeight: rect.height,
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleAircraftPhotoPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!aircraftFieldConfig || !activeAircraftPhotoUrl) {
      return
    }

    const dragState = aircraftPhotoDragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const nextOffsetX = clampNumber(
      dragState.startOffsetX + ((event.clientX - dragState.startX) / Math.max(dragState.rectWidth, 1)) * 100,
      -30,
      30,
    )
    const nextOffsetY = clampNumber(
      dragState.startOffsetY + ((event.clientY - dragState.startY) / Math.max(dragState.rectHeight, 1)) * 100,
      -30,
      30,
    )

    updateField(aircraftFieldConfig.photoOffsetXField, String(Number(nextOffsetX.toFixed(2))))
    updateField(aircraftFieldConfig.photoOffsetYField, String(Number(nextOffsetY.toFixed(2))))
  }

  function handleAircraftPhotoPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = aircraftPhotoDragStateRef.current

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    aircraftPhotoDragStateRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function selectAircraftPhotoOption(option: AircraftPhotoOption) {
    if (!aircraftFieldConfig) {
      return
    }

    updateField(aircraftFieldConfig.photoUrlField, option.image_url)
    updateField(aircraftFieldConfig.photoAttributionField, option.attribution ?? '')
    updateField(aircraftFieldConfig.photoLinkbackField, option.linkback ?? '')
  }

  function handleBackgroundUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (uploadedBackgroundUrlRef.current) {
      URL.revokeObjectURL(uploadedBackgroundUrlRef.current)
    }

    const localUrl = URL.createObjectURL(file)
    uploadedBackgroundUrlRef.current = localUrl
    setBackgroundMode('manual')
    setBackgroundUrl(localUrl)
    setBackgroundInfo({ kind: 'manual', label: file.name })
    setActiveFavoriteKey(null)
    setErrorMessage('')
    event.target.value = ''
  }

  function clearAutoBackgroundCacheEntry(searchKey: string) {
    const cachedBackground = autoBackgroundCacheRef.current.get(searchKey)

    if (!cachedBackground) {
      return
    }

    for (const option of cachedBackground.options) {
      URL.revokeObjectURL(option.objectUrl)
    }

    autoBackgroundCacheRef.current.delete(searchKey)
  }

  function clearBackground() {
    if (uploadedBackgroundUrlRef.current) {
      URL.revokeObjectURL(uploadedBackgroundUrlRef.current)
      uploadedBackgroundUrlRef.current = null
    }

    setBackgroundMode('auto')
    setBackgroundUrl(eventType === 'focus-airport' ? defaultBackgroundAsset : null)
    setBackgroundInfo({ kind: 'fallback' })
    setActiveFavoriteKey(null)
    setErrorMessage('')
  }

  function selectAutoBackgroundOption(option: AutoBackgroundOption) {
    setBackgroundMode('auto')
    setBackgroundUrl(option.objectUrl)
    setBackgroundInfo({ kind: 'auto', label: option.label })
    setActiveFavoriteKey(null)
    setErrorMessage('')
  }

  function randomizeAutoBackgroundOption() {
    if (autoBackgroundOptions.length === 0) {
      return
    }

    const alternativeOptions = autoBackgroundOptions.filter((option) => option.objectUrl !== backgroundUrl)
    const nextOptionsPool = alternativeOptions.length > 0 ? alternativeOptions : autoBackgroundOptions
    const nextOption = nextOptionsPool[Math.floor(Math.random() * nextOptionsPool.length)]

    if (!nextOption) {
      return
    }

    selectAutoBackgroundOption(nextOption)
  }

  function regenerateAutoBackgroundOptions() {
    if (eventType !== 'focus-airport') {
      return
    }

    clearAutoBackgroundCacheEntry(currentSearchKey)
    setAutoBackgroundOptions([])
    setBackgroundMode('auto')
    setBackgroundUrl(defaultBackgroundAsset)
    setBackgroundInfo({ kind: 'fallback' })
    setActiveFavoriteKey(null)
    setAutoBackgroundRefreshVersion((currentValue) => currentValue + 1)
    setErrorMessage('')
  }

  function saveCurrentBackgroundToFavorites() {
    if (!selectedAutoBackgroundOption) {
      return
    }

    const favoriteBackground: FavoriteBackground = {
      key: `${selectedAutoBackgroundOption.key}-${selectedAutoBackgroundOption.sourceUrl}`,
      label: selectedAutoBackgroundOption.label,
      sourceUrl: selectedAutoBackgroundOption.sourceUrl,
      createdAt: Date.now(),
    }

    setFavoriteBackgrounds((currentFavorites) =>
      [favoriteBackground, ...currentFavorites.filter((item) => item.sourceUrl !== favoriteBackground.sourceUrl)].slice(
        0,
        maxFavoriteBackgrounds,
      ),
    )
  }

  async function activateFavoriteBackground(favoriteBackground: FavoriteBackground) {
    setIsApplyingFavoriteBackground(true)
    setErrorMessage('')

    try {
      let objectUrl = favoriteBackgroundAssetUrlsRef.current.get(favoriteBackground.sourceUrl)

      if (!objectUrl) {
        const imageResponse = await fetch(favoriteBackground.sourceUrl, { mode: 'cors' })

        if (!imageResponse.ok) {
          throw new Error('Favorite background fetch failed')
        }

        const imageBlob = await imageResponse.blob()
        objectUrl = URL.createObjectURL(imageBlob)
        favoriteBackgroundAssetUrlsRef.current.set(favoriteBackground.sourceUrl, objectUrl)
      }

      setBackgroundMode('manual')
      setBackgroundUrl(objectUrl)
      setBackgroundInfo({ kind: 'manual', label: favoriteBackground.label })
      setActiveFavoriteKey(favoriteBackground.key)
    } catch {
      setErrorMessage(strings.backgroundFavoriteLoadError)
    } finally {
      setIsApplyingFavoriteBackground(false)
    }
  }

  function removeFavoriteBackground(favoriteKey: string) {
    setFavoriteBackgrounds((currentFavorites) => currentFavorites.filter((favoriteBackground) => favoriteBackground.key !== favoriteKey))

    if (activeFavoriteKey === favoriteKey) {
      setActiveFavoriteKey(null)
    }
  }

  function updateCommunityTeam<K extends keyof CommunityTeam>(
    teamId: number,
    field: K,
    value: CommunityTeam[K],
  ) {
    setCommunityTeams((currentTeams) =>
      currentTeams.map((team) => {
        if (team.id !== teamId) {
          return team
        }

        return {
          ...team,
          [field]: value,
        }
      }),
    )
  }

  function addCommunityTeam() {
    setCommunityTeams((currentTeams) => {
      if (currentTeams.length >= maxCommunityTeams) {
        return currentTeams
      }

      const nextId = currentTeams.reduce((maxId, team) => Math.max(maxId, team.id), 0) + 1

      return [
        ...currentTeams,
        {
          id: nextId,
          name: '',
          countType: 'flights',
          targetAmount: '',
        },
      ]
    })
  }

  function removeCommunityTeam(teamId: number) {
    setCommunityTeams((currentTeams) => {
      if (currentTeams.length <= 1) {
        return currentTeams
      }

      return currentTeams.filter((team) => team.id !== teamId)
    })
  }

  async function renderPreviewToPng(width: number, height: number) {
    if (!previewRef.current) {
      throw new Error('Preview is not ready')
    }

    await document.fonts.ready
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)))

    return toPng(previewRef.current, {
      pixelRatio: 1,
      canvasWidth: width,
      canvasHeight: height,
      width,
      height,
    })
  }

  async function exportBanner() {
    if (!previewRef.current) {
      return
    }

    setIsExporting(true)
    setErrorMessage('')

    try {
      const dataUrl = await renderPreviewToPng(1920, 1080)
      const currentRouteConfig = isRouteEvent(eventType) ? getRouteEventFormConfig(eventType, strings) : null

      const link = document.createElement('a')
      const primaryTitle =
        isVatsimRegionEvent(eventType)
          ? form.vatsimRegionTitle
          : isComplexEvent(eventType)
          ? form.complexEventTitle
          : isRouteEvent(eventType) && currentRouteConfig
          ? form[currentRouteConfig.titleField]
          : eventType === 'community-challenge'
          ? form.challengeName
          : eventType === 'community-goal'
            ? form.communityGoalName
            : form.city
      const safeTitle = slugify(primaryTitle) || activeEvent.exportSlug
      const safeIcao = form.icao.trim().toUpperCase() || 'ICAO'
      const exportTail =
        isVatsimRegionEvent(eventType)
          ? 'vatsim'
          : isComplexEvent(eventType)
          ? 'dual-route'
          : isRouteEvent(eventType)
          ? 'route'
          : eventType === 'community-challenge'
          ? 'teams'
          : eventType === 'community-goal'
            ? 'goal'
            : safeIcao
      const exportBrandSlug = isVatsimRegionEvent(eventType)
        ? vatsimRegionBrand
        : isComplexEvent(eventType)
          ? complexEventBrand
          : activeBrand.exportSlug
      const archiveBrand = isVatsimRegionEvent(eventType)
        ? vatsimRegionBrand
        : isComplexEvent(eventType)
          ? complexEventBrand
          : brandKey

      link.download = `${activeEvent.exportSlug}-${exportBrandSlug}-${safeTitle}-${exportTail}.png`
      link.href = dataUrl
      link.click()

      void archiveCreation({
        eventType,
        brand: archiveBrand,
        title: primaryTitle,
        description:
          isVatsimRegionEvent(eventType)
            ? form.vatsimRegionDescription.trim() || form.vatsimRegionTitle
            : isComplexEvent(eventType)
            ? form.complexEventDescription.trim() || form.complexEventTitle
            : isRouteEvent(eventType) && currentRouteConfig
            ? form[currentRouteConfig.descriptionField].trim() || null
            : eventType === 'community-goal'
              ? form.communityGoalDescription.trim() || form.communityGoalName
              : eventType === 'community-challenge'
                ? form.challengeName
                : form.airportName.trim() || null,
        imageDataUrl: dataUrl,
        metadata: {
          brandSource: isVatsimRegionEvent(eventType)
            ? ['vnws', 'rag', 'vatsim']
            : isComplexEvent(eventType)
              ? ['vnws', 'rag']
              : activeBrandSource,
          bonusPoints: normalizedBonusPoints,
          registrationRequired,
          vatsimEvent: showVatsimBadge,
          city: form.city,
          countryCode: normalizedCountryCode,
          icao: normalizedIcao,
          airportName: normalizedAirportName,
          routeLegs: isVatsimRegionEvent(eventType)
            ? [...vatsimRegionVnwsLegs, ...vatsimRegionRagLegs]
            : isComplexEvent(eventType)
              ? [...complexVnwsLegs, ...complexRagLegs]
              : parsedRouteLegs,
          routeStops: isVatsimRegionEvent(eventType)
            ? vatsimRegionRouteStops
            : isComplexEvent(eventType)
              ? complexRouteStops
              : routeStops,
          complexEventVnwsLegs: form.complexEventVnwsLegs,
          complexEventRagLegs: form.complexEventRagLegs,
          complexEventRouteStops: complexRouteStops,
          complexEventVnwsBonusPoints: form.complexEventVnwsBonusPoints,
          complexEventRagBonusPoints: form.complexEventRagBonusPoints,
          complexEventVnwsRegistrationRequired: form.complexEventVnwsRegistrationRequired,
          complexEventRagRegistrationRequired: form.complexEventRagRegistrationRequired,
          vatsimRegionHosts: form.vatsimRegionHosts,
          vatsimRegionPartners: form.vatsimRegionPartners,
          vatsimRegionPresetIds: selectedVatsimRegionPresetIds,
          vatsimRegionFirIds: selectedVatsimRegionFirIds,
          mapZoom: activeMapZoom,
          mapOffsetX: activeMapOffsetX,
          mapOffsetY: activeMapOffsetY,
          mapTheme: activeMapTheme,
          mapDetailMode: activeMapDetailMode,
          vatsimRegionVnwsLegs: form.vatsimRegionVnwsLegs,
          vatsimRegionRagLegs: form.vatsimRegionRagLegs,
          vatsimRegionRouteStops,
          aircraftSource: activeAircraftSource,
          aircraftName: activeAircraftName,
          aircraftRegistration: activeAircraftRegistration,
          communityTeams: visibleCommunityTeams,
          communityGoalCountType: form.communityGoalCountType,
          communityGoalTargetAmount: form.communityGoalTargetAmount,
        },
      }).catch(() => undefined)
    } catch {
      setErrorMessage(strings.exportError)
    } finally {
      setIsExporting(false)
    }
  }

  async function exportBadge() {
    if (!previewRef.current) {
      return
    }

    setIsExporting(true)
    setErrorMessage('')

    try {
      const dataUrl = await renderPreviewToPng(200, 200)

      const safeTitle = slugify(badgeForm.title) || 'badge'
      const link = document.createElement('a')
      link.download = `badge-${activeBrand.exportSlug}-${safeTitle}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setErrorMessage(badgeStrings.exportError)
    } finally {
      setIsExporting(false)
    }
  }

  function exportCurrentPreview() {
    if (isBadgeMode) {
      void exportBadge()
      return
    }

    void exportBanner()
  }

  async function saveBannerToSiteAssets() {
    if (isBadgeMode) {
      return
    }

    setIsSavingSiteAsset(true)
    setSiteAssetMessage('')
    setSiteAssetUrl('')
    setErrorMessage('')

    try {
      const dataUrl = await renderPreviewToPng(1920, 1080)
      const currentRouteConfig = isRouteEvent(eventType) ? getRouteEventFormConfig(eventType, strings) : null
      const primaryTitle =
        isVatsimRegionEvent(eventType)
          ? form.vatsimRegionTitle
          : isComplexEvent(eventType)
            ? form.complexEventTitle
            : isRouteEvent(eventType) && currentRouteConfig
              ? form[currentRouteConfig.titleField]
              : eventType === 'community-challenge'
                ? form.challengeName
                : eventType === 'community-goal'
                  ? form.communityGoalName
                  : form.city
      const assetUrl = await storeBannerGeneratorAsset({
        imageDataUrl: dataUrl,
        fileName: `${activeBrand.exportSlug}-${slugify(primaryTitle) || activeEvent.exportSlug}`,
      })
      const absoluteUrl = new URL(assetUrl, window.location.origin).toString()

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl)
      }

      setSiteAssetUrl(absoluteUrl)
      setSiteAssetMessage(locale === 'ru' ? 'Баннер сохранён, URL скопирован в буфер обмена.' : 'Banner saved and URL copied to the clipboard.')
    } catch (error) {
      setErrorMessage(String(error instanceof Error ? error.message : error || strings.exportError))
    } finally {
      setIsSavingSiteAsset(false)
    }
  }

  const isComplexEventActive = isComplexEvent(eventType)
  const isVatsimRegionEventActive = isVatsimRegionEvent(eventType)
  const isDualProjectEventActive = isComplexEventActive || isVatsimRegionEventActive
  const isRouteEventActive = isRouteEvent(eventType)
  const isMapEventActive = isRouteEventActive || isDualProjectEventActive
  const isCommunityEventActive = isCommunityEvent(eventType)
  const isRosterAircraftVisual = eventType === 'roster' && form.rosterVisualMode === 'aircraft'
  const isCuratedRosterAircraftVisual = eventType === 'curated-roster' && form.curatedRosterVisualMode === 'aircraft'
  const isSpecificAircraftMode =
    eventType === 'curated-roster'
      ? activeAircraftEnabled && isCuratedRosterAircraftVisual
      : eventType === 'roster'
        ? activeAircraftEnabled && isRosterAircraftVisual
        : isRouteEventActive && activeAircraftEnabled
  const routeEventConfig = isRouteEventActive ? getRouteEventFormConfig(eventType, strings) : null
  const bannerRouteEventConfig = isRouteEventActive ? getRouteEventFormConfig(eventType, bannerStrings) : null
  const complexVnwsLegs = parseTourLegs(form.complexEventVnwsLegs)
  const complexRagLegs = parseTourLegs(form.complexEventRagLegs)
  const complexVnwsLegPairs = parseTourLegPairs(form.complexEventVnwsLegs)
  const complexRagLegPairs = parseTourLegPairs(form.complexEventRagLegs)
  const complexMapLegs: TourMapLeg[] = [
    ...complexVnwsLegPairs.map((pair) => ({ ...pair, tone: 'vnws' as const })),
    ...complexRagLegPairs.map((pair) => ({ ...pair, tone: 'rag' as const })),
  ]
  const complexRouteStops = getTourStops([...complexVnwsLegPairs, ...complexRagLegPairs])
  const complexVisibleVnwsLegs = complexVnwsLegs.slice(0, 3)
  const complexVisibleRagLegs = complexRagLegs.slice(0, 3)
  const complexHiddenVnwsLegCount = Math.max(0, complexVnwsLegs.length - complexVisibleVnwsLegs.length)
  const complexHiddenRagLegCount = Math.max(0, complexRagLegs.length - complexVisibleRagLegs.length)
  const vatsimRegionVnwsLegs = parseTourLegs(form.vatsimRegionVnwsLegs)
  const vatsimRegionRagLegs = parseTourLegs(form.vatsimRegionRagLegs)
  const vatsimRegionVnwsLegPairs = parseTourLegPairs(form.vatsimRegionVnwsLegs)
  const vatsimRegionRagLegPairs = parseTourLegPairs(form.vatsimRegionRagLegs)
  const vatsimRegionMapLegs: TourMapLeg[] = [
    ...vatsimRegionVnwsLegPairs.map((pair) => ({ ...pair, tone: 'vnws' as const })),
    ...vatsimRegionRagLegPairs.map((pair) => ({ ...pair, tone: 'rag' as const })),
  ]
  const vatsimRegionTotalLegCount = vatsimRegionVnwsLegPairs.length + vatsimRegionRagLegPairs.length
  const vatsimRegionRouteStops = getTourStops([...vatsimRegionVnwsLegPairs, ...vatsimRegionRagLegPairs])
  const vatsimRegionCompactLegEntries = [
    ...vatsimRegionVnwsLegs.slice(0, 2).map((leg) => ({ leg, tone: 'vnws' as const })),
    ...vatsimRegionRagLegs.slice(0, 2).map((leg) => ({ leg, tone: 'rag' as const })),
  ]
  const vatsimRegionHiddenLegCount = Math.max(0, vatsimRegionVnwsLegs.length + vatsimRegionRagLegs.length - vatsimRegionCompactLegEntries.length)
  const selectedVatsimRegionDivisionIds = parseSerializedSelection(form.vatsimRegionDivisionSelection)
  const selectedVatsimRegionDivisionIdSet = new Set(selectedVatsimRegionDivisionIds)
  const availableVatsimRegionPresetDefinitions = getPresetDefinitionsForDivisions(selectedVatsimRegionDivisionIds)
  const availableVatsimRegionPresetIdSet = new Set(availableVatsimRegionPresetDefinitions.map((preset) => preset.id))
  const selectedVatsimRegionPresetIds = parseSerializedSelection(form.vatsimRegionPresetSelection).filter((presetId) =>
    availableVatsimRegionPresetIdSet.has(presetId),
  )
  const selectedVatsimRegionPresetIdSet = new Set(selectedVatsimRegionPresetIds)
  const availableVatsimRegionFirIds = getPresetFirIds(selectedVatsimRegionPresetIds)
    .filter((firId) => vatspyTopLevelBoundaryOverlayById.has(firId))
  const explicitVatsimRegionFirIds = normalizeVatsimRegionFirIds(
    parseSerializedSelection(form.vatsimRegionFirSelection),
    availableVatsimRegionFirIds,
  )
  const explicitVatsimRegionFirIdSet = new Set(explicitVatsimRegionFirIds)
  const selectedVatsimRegionFirIds = resolveSelectedFirIds(form.vatsimRegionFirSelection, availableVatsimRegionFirIds)
  const selectedVatsimRegionOverlays = selectedVatsimRegionFirIds.flatMap((firId) => {
    const overlay = vatspyTopLevelBoundaryOverlayById.get(firId)
    return overlay ? [overlay] : []
  })
  const selectedVatsimRegionTraconOverlays = simawareRegionalBoundaryOverlays.filter((overlay) =>
    selectedVatsimRegionPresetIds.some((presetId) => {
      const preset = getPresetDefinitionById(presetId)

      if (!preset) {
        return false
      }

      return preset.traconPrefixes.some((prefix) => overlay.label.startsWith(prefix))
    }),
  )

  const primaryTitle =
    isVatsimRegionEventActive
      ? form.vatsimRegionTitle
      : isComplexEventActive
      ? form.complexEventTitle
      : isRouteEventActive && routeEventConfig
      ? form[routeEventConfig.titleField]
      : eventType === 'community-challenge'
      ? form.challengeName
      : eventType === 'community-goal'
        ? form.communityGoalName
        : form.city
  const titleLines = splitHeadline(primaryTitle)
  const normalizedCountryCode = (form.countryCode ?? '').trim().toUpperCase() || 'RU'
  const normalizedIcao = form.icao.trim().toUpperCase() || 'ICAO'
  const rewardPrefixText = form.rewardPrefixText.trim() || bannerStrings.rewardPrefix
  const rewardSuffixText = form.rewardSuffixText.trim() || bannerStrings.rewardSuffix
  const rawRewardPrefixText = form.rewardPrefixText.trim()
  const rawRewardSuffixText = form.rewardSuffixText.trim()
  const rewardUsesCustomCompactLayout = rawRewardPrefixText.length === 0 || rawRewardSuffixText.length === 0
  const visibleAircraftPhotoOptions = isAircraftPhotoListExpanded ? aircraftPhotoOptions : aircraftPhotoOptions.slice(0, 3)
  const shouldShowAircraftPhotoVisual =
    isRouteEventActive &&
    !!activeAircraftPhotoUrl &&
    (
      eventType === 'curated-roster'
        ? isCuratedRosterAircraftVisual
        : eventType === 'roster'
          ? isRosterAircraftVisual
          : true
    )
  const canShowPreviewPhotoTools = Boolean(!isBadgeMode && aircraftFieldConfig && activeAircraftEnabled && shouldShowAircraftPhotoVisual)
  const canShowPreviewMapTools = Boolean(!isBadgeMode && isMapEventActive && !isSpecificAircraftMode)
  const vatsimRegionUnitLabels = splitCompactMetaList(form.vatsimRegionHosts)
  const vatsimRegionDivisionLabels = getDivisionCodes(selectedVatsimRegionDivisionIds)
  const vatsimRegionDivisionOptions: VatsimRegionSelectionOption[] = vatsimRegionDivisionDefinitions.map((division) => ({
    id: division.id,
    title: division.code,
    meta: division.labels[locale],
    aliases: [division.code, division.labels.ru, division.labels.en],
  }))
  const vatsimRegionDivisionOptionById = new Map(vatsimRegionDivisionOptions.map((option) => [option.id, option] as const))
  const selectedVatsimRegionDivisionOptions = selectedVatsimRegionDivisionIds.flatMap((divisionId) => {
    const option = vatsimRegionDivisionOptionById.get(divisionId)
    return option ? [option] : []
  })
  const availableVatsimRegionDivisionOptions = vatsimRegionDivisionOptions.filter((option) => !selectedVatsimRegionDivisionIdSet.has(option.id))
  const vatsimRegionPresetOptions: VatsimRegionSelectionOption[] = availableVatsimRegionPresetDefinitions.map((preset) => {
    const presetMeta = preset.firIds.join(', ')

    return {
      id: preset.id,
      title: preset.labels[locale],
      meta: presetMeta === preset.labels[locale] ? undefined : presetMeta,
      aliases: [preset.labels.ru, preset.labels.en, ...(preset.firIds.length === 1 ? preset.firIds : [])],
    }
  })
  const vatsimRegionPresetOptionById = new Map(vatsimRegionPresetOptions.map((option) => [option.id, option] as const))
  const selectedVatsimRegionPresetOptions = selectedVatsimRegionPresetIds.flatMap((presetId) => {
    const option = vatsimRegionPresetOptionById.get(presetId)
    return option ? [option] : []
  })
  const availableVatsimRegionPresetOptions = vatsimRegionPresetOptions.filter((option) => !selectedVatsimRegionPresetIdSet.has(option.id))
  const vatsimRegionFirOptions: VatsimRegionSelectionOption[] = availableVatsimRegionFirIds.map((firId) => ({
    id: firId,
    title: firId,
    aliases: [firId],
  }))
  const vatsimRegionFirOptionById = new Map(vatsimRegionFirOptions.map((option) => [option.id, option] as const))
  const selectedVatsimRegionFirOptions = explicitVatsimRegionFirIds.flatMap((firId) => {
    const option = vatsimRegionFirOptionById.get(firId)
    return option ? [option] : []
  })
  const availableVatsimRegionFirOptions = vatsimRegionFirOptions.filter((option) => !explicitVatsimRegionFirIdSet.has(option.id))
  const vatsimRegionDivisionInputPlaceholder = locale === 'ru'
    ? 'Например, VATRUS или VATUSA'
    : 'For example, VATRUS or VATUSA'
  const vatsimRegionPresetInputPlaceholder = locale === 'ru'
    ? 'Введите код или название региона'
    : 'Type a region code or name'
  const vatsimRegionFirInputPlaceholder = locale === 'ru'
    ? 'Введите код FIR'
    : 'Type a FIR code'
  const isVatsimRegionDivisionDropdownOpen = activeVatsimRegionDropdown === 'division'
  const isVatsimRegionPresetDropdownOpen = activeVatsimRegionDropdown === 'preset'
  const isVatsimRegionFirDropdownOpen = activeVatsimRegionDropdown === 'fir'
  const filteredVatsimRegionDivisionOptions = filterVatsimRegionSelectionOptions(
    vatsimRegionDivisionInput,
    availableVatsimRegionDivisionOptions,
  )
  const filteredVatsimRegionPresetOptions = filterVatsimRegionSelectionOptions(
    vatsimRegionPresetInput,
    availableVatsimRegionPresetOptions,
  )
  const filteredVatsimRegionFirOptions = filterVatsimRegionSelectionOptions(
    vatsimRegionFirInput,
    availableVatsimRegionFirOptions,
  )
  const normalizedAirportName = form.airportName.trim() || 'Airport'
  const normalizedBonusPoints = form[getEventBonusPointsField(eventType)].trim() || '0'
  const registrationRequired = form[getEventRegistrationField(eventType)]
  const vatsimEvent = form.vatsimEvent
  const showVatsimBadge = vatsimEvent || isVatsimRegionEventActive
  const showCombinedVatsimBadge = showVatsimBadge && !isVatsimRegionEventActive
  const bannerKickerLabel = isVatsimRegionEventActive ? bannerStrings.vatsimEventBadge : bannerActiveEventName
  const routeLegsValue = routeEventConfig ? form[routeEventConfig.legsField] : ''
  const parsedRouteLegs = parseTourLegs(routeLegsValue)
  const parsedRouteLegPairs = parseTourLegPairs(routeLegsValue)
  const routeStops = getTourStops(parsedRouteLegPairs)
  const displayedRouteLegPairs: TourMapLeg[] = isVatsimRegionEventActive
    ? vatsimRegionMapLegs
    : isComplexEventActive
      ? complexMapLegs
      : parsedRouteLegPairs
  const displayedRouteStops = isVatsimRegionEventActive
    ? vatsimRegionRouteStops
    : isComplexEventActive
      ? complexRouteStops
      : routeStops
  const parsedMapZoom = Number.parseFloat(form.mapZoom)
  const activeMapZoom = Number.isFinite(parsedMapZoom) ? clampNumber(parsedMapZoom, 60, 320) : 100
  const activeMapDetailMode: MapDetailMode = form.mapDetailMode === 'fir-tma' ? 'fir-tma' : 'fir'
  const activeMapRoutePoints = getTourMapData(displayedRouteLegPairs).points
  const activeMapViewportPoints = isVatsimRegionEventActive
    ? [
        ...selectedVatsimRegionOverlays.flatMap((region) => region.viewportPoints),
        ...selectedVatsimRegionTraconOverlays.flatMap((region) => region.viewportPoints),
        ...activeMapRoutePoints,
      ]
    : activeMapRoutePoints
  const activeMapPanLimits = getTourMapPanLimits(activeMapViewportPoints, activeMapZoom)
  const parsedMapOffsetX = Number.parseFloat(form.mapOffsetX)
  const parsedMapOffsetY = Number.parseFloat(form.mapOffsetY)
  const activeMapOffsetX = Number.isFinite(parsedMapOffsetX)
    ? clampNumber(parsedMapOffsetX, -activeMapPanLimits.maxOffsetX, activeMapPanLimits.maxOffsetX)
    : 0
  const activeMapOffsetY = Number.isFinite(parsedMapOffsetY)
    ? clampNumber(parsedMapOffsetY, -activeMapPanLimits.maxOffsetY, activeMapPanLimits.maxOffsetY)
    : 0
  const activeMapTheme: MapThemeMode = form.mapTheme === 'steel' || form.mapTheme === 'aurora' ? form.mapTheme : 'classic'

  useEffect(() => {
    if (!canShowPreviewMapTools) {
      setIsPreviewMapToolsOpen(false)
    }
  }, [canShowPreviewMapTools])

  const maxBannerLegChips = isSpecificAircraftMode ? 3 : 4
  const primaryRouteLegPairs = parsedRouteLegPairs.filter((pair, index, collection) => {
    const pairKey = [pair.from, pair.to].sort().join(':')
    return collection.findIndex((candidate) => [candidate.from, candidate.to].sort().join(':') === pairKey) === index
  })
  const primaryRouteLegs = primaryRouteLegPairs.map((pair) => `${pair.from} - ${pair.to}`)
  const visibleBannerLegs = parsedRouteLegs.slice(0, maxBannerLegChips)
  const hiddenBannerLegCount = Math.max(0, parsedRouteLegs.length - visibleBannerLegs.length)
  const aircraftFocusLegs = parsedRouteLegs.length > maxBannerLegChips ? primaryRouteLegs : parsedRouteLegs
  const visibleAircraftFocusLegs = aircraftFocusLegs.slice(0, maxBannerLegChips)
  const hiddenAircraftFocusLegCount = Math.max(0, aircraftFocusLegs.length - visibleAircraftFocusLegs.length)
  const totalBannerLegCharacters = parsedRouteLegs.reduce((sum, leg) => sum + leg.length, 0)
  const useCompactBannerLegSummary = isSpecificAircraftMode
    ? parsedRouteLegs.length > 6 || totalBannerLegCharacters > 84
    : parsedRouteLegs.length > 4 || totalBannerLegCharacters > 52
  const compactRouteStart = routeStops[0] ?? parsedRouteLegPairs[0]?.from ?? ''
  const compactRouteEnd = routeStops[routeStops.length - 1] ?? parsedRouteLegPairs[parsedRouteLegPairs.length - 1]?.to ?? ''
  const compactRouteMidpoint = routeStops.find((stop, index) => index > 0 && stop !== compactRouteStart && stop !== compactRouteEnd) ?? ''
  const compactRouteSummary =
    compactRouteStart && compactRouteMidpoint
      ? `${compactRouteStart} - ${compactRouteMidpoint}${hiddenBannerLegCount > 0 || routeStops.length > 2 ? ' - ...' : ''}`
      : compactRouteStart && compactRouteEnd && compactRouteStart !== compactRouteEnd
        ? `${compactRouteStart} - ${compactRouteEnd}`
        : compactRouteStart
  const routeDescription = routeEventConfig ? form[routeEventConfig.descriptionField].trim() : ''
  const routeBriefingText =
    isSpecificAircraftMode && !routeDescription ? parsedRouteLegs.join(' / ') : routeDescription
  const rewardLeadText = rewardUsesCustomCompactLayout ? rawRewardPrefixText : rewardPrefixText
  const rewardTailText = rewardUsesCustomCompactLayout ? rawRewardSuffixText : rewardSuffixText
  const communityGoalDescription = form.communityGoalDescription.trim() || bannerStrings.communityGoalPreviewIntro
  const complexEventDescription = form.complexEventDescription.trim()
  const complexEventBrand = 'vnws-rag'
  const vatsimRegionDescription = form.vatsimRegionDescription.trim()
  const vatsimRegionBrand = 'vnws-rag-vatsim'
  const routeAircraftRegistration = activeAircraftRegistration
  const hasAircraftPhotoSearchContext = eventType === 'curated-roster' || eventType === 'roster'
    ? Boolean(activeAircraftName || activeAircraftRegistration)
    : Boolean(routeAircraftRegistration)
  const visibleCommunityTeams = communityTeams.slice(0, maxCommunityTeams).map((team, index) => {
    const countTypeMeta = getCommunityCountTypeMeta(locale, team.countType)

    return {
      ...team,
      name: team.name.trim() || `${strings.communityTeamFallbackName} ${index + 1}`,
      goalLabel: countTypeMeta.label,
      targetLabel: formatTargetAmount(team.targetAmount, locale),
      unitLabel: countTypeMeta.unit,
    }
  })
  const bannerCommunityTeams = communityTeams.slice(0, maxCommunityTeams).map((team, index) => {
    const countTypeMeta = getCommunityCountTypeMeta('en', team.countType)
    return {
      ...team,
      name: team.name.trim() || `${bannerStrings.communityTeamFallbackName} ${index + 1}`,
      goalLabel: countTypeMeta.label,
      targetLabel: formatTargetAmount(team.targetAmount, locale),
      unitLabel: countTypeMeta.unit,
    }
  })
  const bannerCommunityGoalCountTypeMeta = getCommunityCountTypeMeta('en', form.communityGoalCountType)
  const bannerFormattedCommunityGoalTarget = formatTargetAmount(form.communityGoalTargetAmount, locale)
  const countryFlagCode = getFlagAssetCode(normalizedCountryCode)
  const legCountryCodes = displayedRouteLegPairs.flatMap(({ from, to }) => [
    getIcaoCountryCode(from),
    getIcaoCountryCode(to),
  ]).filter((c): c is string => c !== null)
  const showLegFlags = new Set(legCountryCodes).size > 1
  const bannerBackground = backgroundUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(18, 19, 20, 0.72) 0%, rgba(18, 19, 20, 0.48) 34%, rgba(18, 19, 20, 0.16) 76%, rgba(18, 19, 20, 0.03) 100%), url(${backgroundUrl})`,
      }
    : undefined
  const communityTeamsEditor = eventType === 'community-challenge' ? (
    <div className="community-teams-editor">
      <div className="community-team-list">
        {communityTeams.map((team, index) => (
          <div key={team.id} className="community-team-card">
            <div className="community-team-card-header">
              <span className="community-team-index">
                {strings.communityTeamLabel} {index + 1}
              </span>

              <button
                className="ghost-button community-team-remove"
                type="button"
                onClick={() => removeCommunityTeam(team.id)}
                disabled={communityTeams.length <= 1}
              >
                {strings.communityRemoveTeamButton}
              </button>
            </div>

            <div className="community-team-grid">
              <label className="field">
                <span>{strings.communityTeamNameLabel}</span>
                <input
                  type="text"
                  value={team.name}
                  onChange={(event) => updateCommunityTeam(team.id, 'name', event.target.value)}
                  placeholder={`${strings.communityTeamFallbackName} ${index + 1}`}
                />
              </label>

              <label className="field">
                <span>{strings.communityTeamCountTypeLabel}</span>
                <select
                  value={team.countType}
                  onChange={(event) => updateCommunityTeam(team.id, 'countType', event.target.value as ChallengeCountType)}
                >
                  {communityCountTypeOrder.map((countType) => {
                    const countTypeMeta = getCommunityCountTypeMeta(locale, countType)

                    return (
                      <option key={countType} value={countType}>
                        {countTypeMeta.label}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label className="field">
                <span>{strings.communityTeamTargetLabel}</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={team.targetAmount}
                  onChange={(event) => updateCommunityTeam(team.id, 'targetAmount', event.target.value)}
                  placeholder="150"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        className="ghost-button"
        type="button"
        onClick={addCommunityTeam}
        disabled={communityTeams.length >= maxCommunityTeams}
      >
        {strings.communityAddTeamButton}
      </button>
    </div>
  ) : null

  const vatsimRegionCoordinationSection = isVatsimRegionEvent(eventType) ? (
    <SettingsAccordionSection title={strings.vatsimRegionRegionsTitle} defaultOpen>
      <div className="field-group" ref={vatsimRegionDropdownsRef}>
        <div className="field-group vatsim-region-selector-group">
          <span className="section-mini-title">{strings.vatsimRegionPartnersLabel}</span>
          <div className="vatsim-region-combobox">
            {selectedVatsimRegionDivisionOptions.length > 0 ? (
              <div className="vatsim-region-selection-chips" role="list" aria-label={strings.vatsimRegionPartnersLabel}>
                {selectedVatsimRegionDivisionOptions.map((option) => (
                  <button
                    key={option.id}
                    className="vatsim-region-selection-chip"
                    type="button"
                    onClick={() => setForm((current) => buildVatsimRegionSelectionState(current, {
                      divisionIds: parseSerializedSelection(current.vatsimRegionDivisionSelection).filter(
                        (currentDivisionId) => currentDivisionId !== option.id,
                      ),
                    }))}
                    aria-label={locale === 'ru' ? `Убрать ${option.title}` : `Remove ${option.title}`}
                  >
                    <span className="vatsim-region-selection-chip-title">{option.title}</span>
                    {option.meta ? <span className="vatsim-region-selection-chip-meta">{option.meta}</span> : null}
                    <span className="vatsim-region-selection-chip-remove" aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="vatsim-region-combobox-row">
              <input
                value={vatsimRegionDivisionInput}
                onChange={(event) => {
                  setVatsimRegionDivisionInput(event.target.value)
                  setActiveVatsimRegionDropdown('division')
                }}
                onClick={() => setActiveVatsimRegionDropdown('division')}
                onFocus={() => setActiveVatsimRegionDropdown('division')}
                onKeyDown={(event) => handleVatsimRegionSelectionInputKeyDown(event, () => commitVatsimRegionDivisionInput(vatsimRegionDivisionOptions))}
                placeholder={vatsimRegionDivisionInputPlaceholder}
                aria-expanded={isVatsimRegionDivisionDropdownOpen}
                aria-haspopup="listbox"
                aria-controls="vatsim-region-division-dropdown"
              />
              <button
                className={`mini-choice-card vatsim-region-combobox-trigger${isVatsimRegionDivisionDropdownOpen ? ' is-open' : ''}`}
                type="button"
                onClick={() => toggleVatsimRegionDropdown('division')}
                aria-label={locale === 'ru' ? 'Открыть список дивизионов' : 'Open divisions list'}
                aria-expanded={isVatsimRegionDivisionDropdownOpen}
                aria-haspopup="listbox"
                aria-controls="vatsim-region-division-dropdown"
              >
                <span className="vatsim-region-combobox-trigger-icon" aria-hidden="true">v</span>
              </button>
              <button
                className="mini-choice-card vatsim-region-combobox-add"
                type="button"
                onClick={() => commitVatsimRegionDivisionInput(vatsimRegionDivisionOptions)}
                disabled={vatsimRegionDivisionInput.trim().length === 0}
              >
                {locale === 'ru' ? 'Добавить' : 'Add'}
              </button>
            </div>

            {isVatsimRegionDivisionDropdownOpen ? (
              <div className="vatsim-region-dropdown" id="vatsim-region-division-dropdown" role="listbox" aria-label={strings.vatsimRegionPartnersLabel}>
                {filteredVatsimRegionDivisionOptions.length > 0 ? (
                  filteredVatsimRegionDivisionOptions.map((option) => (
                    <button
                      key={option.id}
                      className="vatsim-region-dropdown-option"
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => appendVatsimRegionDivisionSelection([option.id])}
                    >
                      <span className="vatsim-region-dropdown-option-title">{option.title}</span>
                      {option.meta ? <span className="vatsim-region-dropdown-option-meta">{option.meta}</span> : null}
                    </button>
                  ))
                ) : (
                  <div className="vatsim-region-dropdown-empty">
                    {locale === 'ru' ? 'Нет подходящих дивизионов.' : 'No matching divisions.'}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <p className="field-help">
            {locale === 'ru'
              ? 'Сначала выберите дивизионы. Список регионов ниже автоматически отфильтруется под них.'
              : 'Select the divisions first. The region list below is filtered automatically.'}
          </p>
        </div>

        <div className="field-group vatsim-region-selector-group">
          <span className="section-mini-title">{locale === 'ru' ? 'Регионы' : 'Regions'}</span>
          {availableVatsimRegionPresetDefinitions.length > 0 ? (
            <>
              <div className="vatsim-region-combobox">
                {selectedVatsimRegionPresetOptions.length > 0 ? (
                  <div className="vatsim-region-selection-chips" role="list" aria-label={locale === 'ru' ? 'Выбранные регионы' : 'Selected regions'}>
                    {selectedVatsimRegionPresetOptions.map((option) => (
                      <button
                        key={option.id}
                        className="vatsim-region-selection-chip"
                        type="button"
                        onClick={() => setForm((current) => buildVatsimRegionSelectionState(current, {
                          presetIds: parseSerializedSelection(current.vatsimRegionPresetSelection).filter(
                            (currentPresetId) => currentPresetId !== option.id,
                          ),
                        }))}
                        aria-label={locale === 'ru' ? `Убрать ${option.title}` : `Remove ${option.title}`}
                      >
                        <span className="vatsim-region-selection-chip-title">{option.title}</span>
                        {option.meta ? <span className="vatsim-region-selection-chip-meta">{option.meta}</span> : null}
                        <span className="vatsim-region-selection-chip-remove" aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="vatsim-region-combobox-row">
                  <input
                    value={vatsimRegionPresetInput}
                    onChange={(event) => {
                      setVatsimRegionPresetInput(event.target.value)
                      setActiveVatsimRegionDropdown('preset')
                    }}
                    onClick={() => setActiveVatsimRegionDropdown('preset')}
                    onFocus={() => setActiveVatsimRegionDropdown('preset')}
                    onKeyDown={(event) => handleVatsimRegionSelectionInputKeyDown(event, () => commitVatsimRegionPresetInput(vatsimRegionPresetOptions))}
                    placeholder={vatsimRegionPresetInputPlaceholder}
                    aria-expanded={isVatsimRegionPresetDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="vatsim-region-preset-dropdown"
                  />
                  <button
                    className={`mini-choice-card vatsim-region-combobox-trigger${isVatsimRegionPresetDropdownOpen ? ' is-open' : ''}`}
                    type="button"
                    onClick={() => toggleVatsimRegionDropdown('preset')}
                    aria-label={locale === 'ru' ? 'Открыть список регионов' : 'Open regions list'}
                    aria-expanded={isVatsimRegionPresetDropdownOpen}
                    aria-haspopup="listbox"
                    aria-controls="vatsim-region-preset-dropdown"
                  >
                    <span className="vatsim-region-combobox-trigger-icon" aria-hidden="true">v</span>
                  </button>
                  <button
                    className="mini-choice-card vatsim-region-combobox-add"
                    type="button"
                    onClick={() => commitVatsimRegionPresetInput(vatsimRegionPresetOptions)}
                    disabled={vatsimRegionPresetInput.trim().length === 0}
                  >
                    {locale === 'ru' ? 'Добавить' : 'Add'}
                  </button>
                </div>

                {isVatsimRegionPresetDropdownOpen ? (
                  <div className="vatsim-region-dropdown" id="vatsim-region-preset-dropdown" role="listbox" aria-label={locale === 'ru' ? 'Регионы' : 'Regions'}>
                    {filteredVatsimRegionPresetOptions.length > 0 ? (
                      filteredVatsimRegionPresetOptions.map((option) => (
                        <button
                          key={option.id}
                          className="vatsim-region-dropdown-option"
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => appendVatsimRegionPresetSelection([option.id])}
                        >
                          <span className="vatsim-region-dropdown-option-title">{option.title}</span>
                          {option.meta ? <span className="vatsim-region-dropdown-option-meta">{option.meta}</span> : null}
                        </button>
                      ))
                    ) : (
                      <div className="vatsim-region-dropdown-empty">
                        {locale === 'ru' ? 'Нет подходящих регионов.' : 'No matching regions.'}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="field-help">
                {locale === 'ru'
                  ? 'Пресеты собираются из VATSPY FIR boundaries и SimAware TRACON files. Выбранные регионы подсвечивают соответствующие зоны на карте.'
                  : 'These presets are built from VATSPY FIR boundaries and SimAware TRACON files. Selected regions highlight the matching zones on the map.'}
              </p>
            </>
          ) : (
            <p className="field-help">
              {locale === 'ru'
                ? 'Выберите хотя бы один дивизион, чтобы открыть список регионов.'
                : 'Select at least one division to unlock the region list.'}
            </p>
          )}
        </div>

        {availableVatsimRegionFirIds.length > 0 ? (
          <div className="field-group vatsim-region-selector-group">
            <span className="section-mini-title">{locale === 'ru' ? 'РПИ / FIR' : 'FIRs / Boundaries'}</span>
            <div className="vatsim-region-combobox">
              {selectedVatsimRegionFirOptions.length > 0 ? (
                <div className="vatsim-region-selection-chips" role="list" aria-label={locale === 'ru' ? 'Выбранные FIR' : 'Selected FIRs'}>
                  {selectedVatsimRegionFirOptions.map((option) => (
                    <button
                      key={option.id}
                      className="vatsim-region-selection-chip"
                      type="button"
                      onClick={() => setForm((current) => {
                        const currentDivisionIds = parseSerializedSelection(current.vatsimRegionDivisionSelection)
                        const availablePresetIds = getPresetDefinitionsForDivisions(currentDivisionIds).map((preset) => preset.id)
                        const currentPresetIds = normalizeVatsimRegionPresetIds(
                          parseSerializedSelection(current.vatsimRegionPresetSelection),
                          availablePresetIds,
                        )

                        return buildVatsimRegionSelectionState(current, {
                          presetIds: currentPresetIds,
                          firIds: parseSerializedSelection(current.vatsimRegionFirSelection).filter(
                            (currentFirId) => currentFirId !== option.id,
                          ),
                        })
                      })}
                      aria-label={locale === 'ru' ? `Убрать ${option.title}` : `Remove ${option.title}`}
                    >
                      <span className="vatsim-region-selection-chip-title">{option.title}</span>
                      <span className="vatsim-region-selection-chip-remove" aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="vatsim-region-combobox-row">
                <input
                  value={vatsimRegionFirInput}
                  onChange={(event) => {
                    setVatsimRegionFirInput(event.target.value)
                    setActiveVatsimRegionDropdown('fir')
                  }}
                  onClick={() => setActiveVatsimRegionDropdown('fir')}
                  onFocus={() => setActiveVatsimRegionDropdown('fir')}
                  onKeyDown={(event) => handleVatsimRegionSelectionInputKeyDown(event, () => commitVatsimRegionFirInput(vatsimRegionFirOptions))}
                  placeholder={vatsimRegionFirInputPlaceholder}
                  aria-expanded={isVatsimRegionFirDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="vatsim-region-fir-dropdown"
                />
                <button
                  className={`mini-choice-card vatsim-region-combobox-trigger${isVatsimRegionFirDropdownOpen ? ' is-open' : ''}`}
                  type="button"
                  onClick={() => toggleVatsimRegionDropdown('fir')}
                  aria-label={locale === 'ru' ? 'Открыть список FIR' : 'Open FIR list'}
                  aria-expanded={isVatsimRegionFirDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="vatsim-region-fir-dropdown"
                >
                  <span className="vatsim-region-combobox-trigger-icon" aria-hidden="true">v</span>
                </button>
                <button
                  className="mini-choice-card vatsim-region-combobox-add"
                  type="button"
                  onClick={() => commitVatsimRegionFirInput(vatsimRegionFirOptions)}
                  disabled={vatsimRegionFirInput.trim().length === 0}
                >
                  {locale === 'ru' ? 'Добавить' : 'Add'}
                </button>
              </div>

              {isVatsimRegionFirDropdownOpen ? (
                <div className="vatsim-region-dropdown" id="vatsim-region-fir-dropdown" role="listbox" aria-label={locale === 'ru' ? 'РПИ / FIR' : 'FIRs / Boundaries'}>
                  {filteredVatsimRegionFirOptions.length > 0 ? (
                    filteredVatsimRegionFirOptions.map((option) => (
                      <button
                        key={option.id}
                        className="vatsim-region-dropdown-option"
                        type="button"
                        role="option"
                        aria-selected="false"
                        onClick={() => appendVatsimRegionFirSelection([option.id])}
                      >
                        <span className="vatsim-region-dropdown-option-title">{option.title}</span>
                      </button>
                    ))
                  ) : (
                    <div className="vatsim-region-dropdown-empty">
                      {locale === 'ru' ? 'Нет подходящих FIR.' : 'No matching FIRs.'}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <p className="field-help">
              {locale === 'ru'
                ? 'Если список FIR пуст, по умолчанию активны все FIR из выбранных регионов. Автозум учитывает выбранные РПИ и введённые леги одновременно.'
                : 'If the FIR selection is empty, all FIRs from the chosen regions stay active by default. Auto-zoom uses both the selected FIRs and the entered legs.'}
            </p>
          </div>
        ) : null}

        <div className="field-group">
          <label className="field">
            <span>{strings.vatsimRegionHostsLabel}</span>
            <input
              type="text"
              value={form.vatsimRegionHosts}
              onChange={(event) => updateField('vatsimRegionHosts', event.target.value)}
              placeholder={strings.vatsimRegionHostsPlaceholder}
            />
          </label>
          <p className="field-help">
            {locale === 'ru'
              ? 'Это ручной список ACC / vACC / ARTCC. Он выводится отдельными чипами в превью и не влияет на фильтрацию карты.'
              : 'This is a manual ACC / vACC / ARTCC list. It is shown as separate chips in the preview and does not affect map filtering.'}
          </p>
        </div>
      </div>
    </SettingsAccordionSection>
  ) : null

  const imageAndLogoControls = (
    <>
      <div className="upload-block">
        <div>
          <span className="upload-title">{visualSectionCopy.label}</span>
          <p className="upload-help">{visualSectionCopy.help}</p>
        </div>

        {!isBuiltInMapOnlyEvent ? (
          <label className="upload-button">
            <input type="file" accept="image/*" onChange={handleBackgroundUpload} />
            {strings.choosePhotoButton}
          </label>
        ) : null}

        <div className="upload-file">{displayedBackgroundName}</div>

        {isVatsimRegionEvent(eventType) ? (
          <div className="field-group">
            <span className="section-mini-title">{strings.vatsimRegionProjectsTitle}</span>

            <div className="complex-event-grid">
              <label className="field">
                <span>{strings.vatsimRegionVnwsLegsLabel}</span>
                <textarea
                  className="vatsim-region-legs-textarea"
                  rows={4}
                  value={form.vatsimRegionVnwsLegs}
                  onChange={(event) => updateField('vatsimRegionVnwsLegs', event.target.value)}
                  placeholder={strings.tourLegsPlaceholder}
                />
              </label>

              <label className="field">
                <span>{strings.vatsimRegionRagLegsLabel}</span>
                <textarea
                  className="vatsim-region-legs-textarea"
                  rows={4}
                  value={form.vatsimRegionRagLegs}
                  onChange={(event) => updateField('vatsimRegionRagLegs', event.target.value)}
                  placeholder={strings.tourLegsPlaceholder}
                />
              </label>
            </div>

            <p className="field-help">{strings.vatsimRegionLegsHelp}</p>
          </div>
        ) : isComplexEvent(eventType) ? (
          <div className="field-group">
            <span className="section-mini-title">{strings.complexEventProjectsLabel}</span>

            <div className="complex-event-grid">
              <label className="field">
                <span>{strings.complexEventVnwsLegsLabel}</span>
                <textarea
                  rows={6}
                  value={form.complexEventVnwsLegs}
                  onChange={(event) => updateField('complexEventVnwsLegs', event.target.value)}
                  placeholder={strings.tourLegsPlaceholder}
                />
              </label>

              <label className="field">
                <span>{strings.complexEventRagLegsLabel}</span>
                <textarea
                  rows={6}
                  value={form.complexEventRagLegs}
                  onChange={(event) => updateField('complexEventRagLegs', event.target.value)}
                  placeholder={strings.tourLegsPlaceholder}
                />
              </label>
            </div>

            <p className="field-help">{strings.complexEventLegsHelp}</p>

            <div className="complex-event-project-grid">
              <article className="complex-event-project-card is-vnws">
                <div className="complex-event-project-header">
                  <strong>vNWS</strong>
                  <span>{strings.complexEventVnwsLegsLabel}</span>
                </div>

                <label className="field">
                  <span>{strings.complexEventVnwsBonusLabel}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.complexEventVnwsBonusPoints}
                    onChange={(event) => updateField('complexEventVnwsBonusPoints', event.target.value)}
                    placeholder="350"
                  />
                </label>

                <label className="toggle-field toggle-field-wide">
                  <input
                    type="checkbox"
                    checked={form.complexEventVnwsRegistrationRequired}
                    onChange={(event) => updateField('complexEventVnwsRegistrationRequired', event.target.checked)}
                  />
                  <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                  <span className="toggle-help">vNWS</span>
                </label>
              </article>

              <article className="complex-event-project-card is-rag">
                <div className="complex-event-project-header">
                  <strong>RAG</strong>
                  <span>{strings.complexEventRagLegsLabel}</span>
                </div>

                <label className="field">
                  <span>{strings.complexEventRagBonusLabel}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.complexEventRagBonusPoints}
                    onChange={(event) => updateField('complexEventRagBonusPoints', event.target.value)}
                    placeholder="350"
                  />
                </label>

                <label className="toggle-field toggle-field-wide">
                  <input
                    type="checkbox"
                    checked={form.complexEventRagRegistrationRequired}
                    onChange={(event) => updateField('complexEventRagRegistrationRequired', event.target.checked)}
                  />
                  <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                  <span className="toggle-help">RAG</span>
                </label>
              </article>
            </div>
          </div>
        ) : null}

        {eventType === 'focus-airport' && autoBackgroundOptions.length > 0 ? (
          <div className="auto-background-picker">
            <span className="section-mini-title">{strings.backgroundSuggestionsLabel}</span>

            <div className="auto-background-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={randomizeAutoBackgroundOption}
                disabled={autoBackgroundOptions.length === 0 || isAutoSelectingBackground || isApplyingFavoriteBackground}
              >
                {strings.backgroundRandomizeButton}
              </button>

              <button
                className="ghost-button"
                type="button"
                onClick={regenerateAutoBackgroundOptions}
                disabled={isAutoSelectingBackground || isApplyingFavoriteBackground}
              >
                {strings.backgroundRegenerateButton}
              </button>

              <button
                className="ghost-button"
                type="button"
                onClick={saveCurrentBackgroundToFavorites}
                disabled={!selectedAutoBackgroundOption || isAutoSelectingBackground || isApplyingFavoriteBackground || isFavoriteBackgroundSaved}
              >
                {strings.backgroundSaveFavoriteButton}
              </button>
            </div>

            <div className="auto-background-grid">
              {autoBackgroundOptions.map((option) => (
                <button
                  key={option.key}
                  className={`auto-background-card${backgroundUrl === option.objectUrl ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => selectAutoBackgroundOption(option)}
                  aria-pressed={backgroundUrl === option.objectUrl}
                >
                  <span
                    className="auto-background-card-image"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(10, 12, 16, 0.04), rgba(10, 12, 16, 0.28)), url(${option.objectUrl})`,
                    }}
                    aria-hidden="true"
                  ></span>
                  <span className="auto-background-card-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {eventType === 'focus-airport' ? (
          <div className="favorite-background-picker">
            <span className="section-mini-title">{strings.backgroundFavoritesLabel}</span>

            {favoriteBackgrounds.length > 0 ? (
              <div className="favorite-background-grid">
                {favoriteBackgrounds.map((favoriteBackground) => (
                  <article
                    key={favoriteBackground.key}
                    className={`favorite-background-card${activeFavoriteKey === favoriteBackground.key ? ' is-active' : ''}`}
                  >
                    <button
                      className="favorite-background-select"
                      type="button"
                      onClick={() => void activateFavoriteBackground(favoriteBackground)}
                      disabled={isApplyingFavoriteBackground}
                      aria-pressed={activeFavoriteKey === favoriteBackground.key}
                    >
                      <span
                        className="auto-background-card-image"
                        style={{
                          backgroundImage: `linear-gradient(180deg, rgba(10, 12, 16, 0.04), rgba(10, 12, 16, 0.28)), url(${favoriteBackground.sourceUrl})`,
                        }}
                        aria-hidden="true"
                      ></span>
                      <span className="auto-background-card-label">{favoriteBackground.label}</span>
                    </button>

                    <button
                      className="favorite-background-remove"
                      type="button"
                      onClick={() => removeFavoriteBackground(favoriteBackground.key)}
                    >
                      {strings.backgroundRemoveFavoriteButton}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="field-help">{strings.backgroundFavoritesEmptyLabel}</p>
            )}
          </div>
        ) : null}

        {aircraftFieldConfig && activeAircraftEnabled && hasAircraftPhotoSearchContext ? (
          <div className="aircraft-photo-picker">
            <div className="aircraft-photo-heading">
              <span className="section-mini-title">{strings.aircraftPhotoLabel}</span>
              {import.meta.env.DEV ? (
                <button
                  className="ghost-button aircraft-photo-debug-toggle"
                  type="button"
                  onClick={() => setIsAircraftPhotoDebugOpen((current) => !current)}
                  aria-expanded={isAircraftPhotoDebugOpen}
                >
                  Debug
                </button>
              ) : null}
            </div>
            <p className="field-help">{strings.aircraftPhotoHelp}</p>
            {import.meta.env.DEV && isAircraftPhotoDebugOpen ? (
              <p className="field-help aircraft-photo-debug">
                {`debug: source=${activeAircraftSource || '-'} | id=${activeAircraftId || '-'} | reg=${activeAircraftRegistration || '-'} | type=${activeAircraftName || '-'} | options=${aircraftPhotoOptions.length} | active=${activeAircraftPhotoUrl ? 'yes' : 'no'}`}
              </p>
            ) : null}

            {aircraftPhotoOptions.length > 0 ? (
              <>
                <div className="aircraft-photo-grid">
                {visibleAircraftPhotoOptions.map((option) => (
                  <button
                    key={`${option.provider}-${option.image_url}`}
                    className={`auto-background-card${activeAircraftPhotoUrl === option.image_url ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => selectAircraftPhotoOption(option)}
                    aria-pressed={activeAircraftPhotoUrl === option.image_url}
                  >
                    <span
                      className="auto-background-card-image"
                      style={{
                        backgroundImage: `linear-gradient(180deg, rgba(10, 12, 16, 0.04), rgba(10, 12, 16, 0.28)), url(${option.thumbnail_url ?? option.image_url})`,
                      }}
                      aria-hidden="true"
                    ></span>
                    <span className="auto-background-card-label">{option.provider}</span>
                    {option.attribution ? (
                      <span className="aircraft-photo-attribution">
                        {strings.aircraftPhotoAttributionPrefix}
                        {option.attribution}
                      </span>
                    ) : null}
                  </button>
                ))}
                </div>

                {aircraftPhotoOptions.length > 3 ? (
                  <button
                    className="ghost-button aircraft-photo-toggle"
                    type="button"
                    onClick={() => setIsAircraftPhotoListExpanded((current) => !current)}
                  >
                    {isAircraftPhotoListExpanded ? strings.aircraftPhotoToggleLess : strings.aircraftPhotoToggleMore}
                  </button>
                ) : null}
              </>
            ) : isLoadingAircraftPhotos ? (
              <p className="field-help">{strings.aircraftPhotoLoading}</p>
            ) : (
              <p className="field-help">{strings.aircraftPhotoEmpty}</p>
            )}

            {activeAircraftPhotoAttribution ? (
              <p className="field-help">
                {strings.aircraftPhotoAttributionPrefix}
                {activeAircraftPhotoLinkback ? (
                  <a href={activeAircraftPhotoLinkback} target="_blank" rel="noreferrer">
                    {activeAircraftPhotoAttribution}
                  </a>
                ) : (
                  activeAircraftPhotoAttribution
                )}
              </p>
            ) : null}

            {activeAircraftPhotoUrl && !canShowPreviewPhotoTools ? (
              <div className="aircraft-photo-adjustment">
                <span className="section-mini-title">{strings.aircraftPhotoAdjustLabel}</span>
                <p className="field-help">{strings.previewPhotoDragHint}</p>

                <div className="aircraft-photo-adjust-grid">
                  <label className="range-control">
                    <span className="range-control-header">
                      <span>{strings.aircraftPhotoOffsetXLabel}</span>
                      <span className="range-control-value">{Math.round(activeAircraftPhotoOffsetX)}%</span>
                    </span>
                    <input
                      className="range-control-input"
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={form[aircraftFieldConfig.photoOffsetXField]}
                      onChange={(event) => updateField(aircraftFieldConfig.photoOffsetXField, event.target.value)}
                    />
                  </label>

                  <label className="range-control">
                    <span className="range-control-header">
                      <span>{strings.aircraftPhotoOffsetYLabel}</span>
                      <span className="range-control-value">{Math.round(activeAircraftPhotoOffsetY)}%</span>
                    </span>
                    <input
                      className="range-control-input"
                      type="range"
                      min="-30"
                      max="30"
                      step="1"
                      value={form[aircraftFieldConfig.photoOffsetYField]}
                      onChange={(event) => updateField(aircraftFieldConfig.photoOffsetYField, event.target.value)}
                    />
                  </label>

                  <label className="range-control">
                    <span className="range-control-header">
                      <span>{strings.aircraftPhotoZoomLabel}</span>
                      <span className="range-control-value">{Math.round(activeAircraftPhotoZoom)}%</span>
                    </span>
                    <input
                      className="range-control-input"
                      type="range"
                      min="70"
                      max="170"
                      step="1"
                      value={form[aircraftFieldConfig.photoZoomField]}
                      onChange={(event) => updateField(aircraftFieldConfig.photoZoomField, event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isBuiltInMapOnlyEvent && backgroundMode === 'manual' ? (
          <button className="ghost-button" type="button" onClick={clearBackground}>
            {strings.restoreDefaultBackgroundButton}
          </button>
        ) : null}
      </div>

      <div className="upload-block upload-block-logo">
        <div>
          <span className="upload-title">{strings.logoLabel}</span>
          <p className="upload-help">{strings.logoHelp}</p>
        </div>

        <div className="upload-file">{displayedLogoName}</div>

        <div className="logo-overlay-control">
          <div className="logo-overlay-header">
            <span className="upload-title">{strings.logoOverlayLabel}</span>
            <span className="logo-overlay-value">{Math.round(logoOverlayOpacity * 100)}%</span>
          </div>
          <p className="upload-help">{strings.logoOverlayHelp}</p>
          <input
            className="logo-overlay-range"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={logoOverlayOpacity}
            onChange={(e) => setLogoOverlayOpacity(Number(e.target.value))}
          />
        </div>
      </div>
    </>
  )

  return (
    <div className={`app-shell brand-${brandKey}`}>
      <aside className="control-panel">
        <div className="panel-copy">
          <div className="panel-topbar">
            <span className="panel-kicker">{activeBrand.fullName}</span>

            <div className="panel-topbar-tools">
              <button className="icon-button" type="button" onClick={() => setIsGuideOpen(true)} aria-label={guideStrings.title}>
                ?
              </button>

              <button className="ghost-button panel-archive-button" type="button" onClick={() => setIsArchiveOpen(true)}>
                {guideStrings.archiveTitle}
              </button>

              <div className="language-switcher" role="group" aria-label={strings.interfaceLanguageLabel}>
                <button
                  className={`language-button${locale === 'ru' ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setLocale('ru')}
                  aria-pressed={locale === 'ru'}
                >
                  RU
                </button>
                <button
                  className={`language-button${locale === 'en' ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setLocale('en')}
                  aria-pressed={locale === 'en'}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="app-mode-tabs" role="tablist" aria-label="Generator mode">
            <button
              className={`app-mode-tab${appMode === 'banner' ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={appMode === 'banner'}
              onClick={() => setAppMode('banner')}
            >
              {badgeStrings.appTabBanner}
            </button>
            <button
              className={`app-mode-tab${appMode === 'badge' ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={appMode === 'badge'}
              onClick={() => setAppMode('badge')}
            >
              {badgeStrings.appTabBadge}
            </button>
          </div>

          <h1>{isBadgeMode ? badgeStrings.appTitle : strings.appTitle}</h1>
          <p>{isBadgeMode ? badgeStrings.appDescription : strings.appDescription}</p>

          <div className="project-switcher-wrap">
            <span className="project-switcher-label">{strings.projectLabel}</span>

            <div className="project-switcher" role="group" aria-label={strings.projectLabel}>
              {brandOrder.map((brandOption) => {
                const brandOptionInfo = brandDefinitions[brandOption]

                return (
                  <button
                    key={brandOption}
                    className={`project-button${brandKey === brandOption ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setBrandKey(brandOption)}
                    aria-pressed={brandKey === brandOption}
                  >
                    <span className="project-button-title">{brandOptionInfo.fullName}</span>
                    <span className="project-button-code">{brandOptionInfo.shortName}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {!isBadgeMode ? (
            <div className="project-switcher-wrap">
              <span className="project-switcher-label">{strings.eventTypeLabel}</span>

              <div className="project-switcher" role="group" aria-label={strings.eventTypeLabel}>
                {eventOrder.map((eventOption) => {
                  const eventOptionInfo = eventDefinitions[eventOption]

                  return (
                    <button
                      key={eventOption}
                      className={`project-button${eventType === eventOption ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => setEventType(eventOption)}
                      aria-pressed={eventType === eventOption}
                    >
                      <span className="project-button-title">{getEventName(eventOption, strings)}</span>
                      <span className="project-button-code">{eventOptionInfo.shortName}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        {!isBadgeMode ? (
        <section className="panel-card">
          <h2>{strings.bannerSettingsTitle}</h2>

          {!isRouteEventActive && !isVatsimRegionEvent(eventType) ? (
            <label className="toggle-field toggle-field-wide">
              <input
                type="checkbox"
                checked={form.vatsimEvent}
                onChange={(event) => updateField('vatsimEvent', event.target.checked)}
              />
              <span className="toggle-title">{strings.vatsimEventLabel}</span>
              <span className="toggle-help">{strings.vatsimEventHelp}</span>
            </label>
          ) : null}

          {isVatsimRegionEvent(eventType) ? (
            <>
              <SettingsAccordionSection title={strings.vatsimRegionTitleLabel} defaultOpen>
                <label className="field">
                  <span>{strings.vatsimRegionTitleLabel}</span>
                  <input
                    type="text"
                    value={form.vatsimRegionTitle}
                    onChange={(event) => updateField('vatsimRegionTitle', event.target.value)}
                    placeholder={strings.vatsimRegionTitlePlaceholder}
                  />
                </label>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.vatsimRegionDescriptionLabel} defaultOpen>
                <div className="field-group">
                  <label className="field tour-description-field">
                    <span>{strings.vatsimRegionDescriptionLabel}</span>
                    <textarea
                      rows={4}
                      value={form.vatsimRegionDescription}
                      onChange={(event) => updateField('vatsimRegionDescription', event.target.value)}
                      placeholder={strings.vatsimRegionDescriptionPlaceholder}
                    />
                  </label>
                  <p className="field-help">{strings.vatsimRegionDescriptionHelp}</p>
                </div>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.vatsimRegionBonusLabel} defaultOpen>
                <div className="settings-accordion-stack">
                  <label className="field">
                    <span>{strings.vatsimRegionBonusLabel}</span>
                    <input
                      type="number"
                      min="0"
                      value={form.vatsimRegionBonusPoints}
                      onChange={(event) => updateField('vatsimRegionBonusPoints', event.target.value)}
                      placeholder="500"
                    />
                  </label>

                  <div className="event-meta-grid">
                    <label className="toggle-field">
                      <input
                        type="checkbox"
                        checked={form.vatsimRegionRegistrationRequired}
                        onChange={(event) => updateField('vatsimRegionRegistrationRequired', event.target.checked)}
                      />
                      <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                      <span className="toggle-help">{strings.registrationRequiredHelp}</span>
                    </label>
                  </div>
                </div>
              </SettingsAccordionSection>

            </>
          ) : isComplexEvent(eventType) ? (
            <>
              <SettingsAccordionSection title={strings.complexEventTitleLabel} defaultOpen>
                <label className="field">
                  <span>{strings.complexEventTitleLabel}</span>
                  <input
                    type="text"
                    value={form.complexEventTitle}
                    onChange={(event) => updateField('complexEventTitle', event.target.value)}
                    placeholder={strings.complexEventTitlePlaceholder}
                  />
                </label>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.complexEventDescriptionLabel} defaultOpen>
                <div className="field-group">
                  <label className="field tour-description-field">
                    <span>{strings.complexEventDescriptionLabel}</span>
                    <textarea
                      rows={4}
                      value={form.complexEventDescription}
                      onChange={(event) => updateField('complexEventDescription', event.target.value)}
                      placeholder={strings.complexEventDescriptionPlaceholder}
                    />
                  </label>
                  <p className="field-help">{strings.complexEventDescriptionHelp}</p>
                </div>
              </SettingsAccordionSection>
            </>
          ) : eventType === 'community-challenge' ? (
            <>
              <label className="field">
                <span>{strings.challengeNameLabel}</span>
                <input
                  type="text"
                  value={form.challengeName}
                  onChange={(event) => updateField('challengeName', event.target.value)}
                  placeholder={strings.challengeNamePlaceholder}
                />
              </label>

              <div className="event-meta-grid">
                <label className="field">
                  <span>{strings.bonusPointsLabel}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.challengeBonusPoints}
                    onChange={(event) => updateField('challengeBonusPoints', event.target.value)}
                    placeholder="350"
                  />
                </label>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={form.challengeRegistrationRequired}
                    onChange={(event) => updateField('challengeRegistrationRequired', event.target.checked)}
                  />
                  <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                  <span className="toggle-help">{strings.registrationRequiredHelp}</span>
                </label>
              </div>
            </>
          ) : eventType === 'community-goal' ? (
            <>
              <label className="field">
                <span>{strings.communityGoalNameLabel}</span>
                <input
                  type="text"
                  value={form.communityGoalName}
                  onChange={(event) => updateField('communityGoalName', event.target.value)}
                  placeholder={strings.communityGoalNamePlaceholder}
                />
              </label>

              <label className="field">
                <span>{strings.communityGoalDescriptionLabel}</span>
                <textarea
                  value={form.communityGoalDescription}
                  onChange={(event) => updateField('communityGoalDescription', event.target.value)}
                  placeholder={strings.communityGoalDescriptionPlaceholder}
                  rows={4}
                />
              </label>
              <p className="field-help">{strings.communityGoalDescriptionHelp}</p>

              <div className="field-group">
                <span className="section-mini-title">{strings.communityGoalCountTypeLabel}</span>

                <div className="metric-choice-grid" role="group" aria-label={strings.communityGoalCountTypeLabel}>
                  {communityCountTypeOrder.map((countType) => {
                    const countTypeMeta = getCommunityCountTypeMeta(locale, countType)

                    return (
                      <button
                        key={countType}
                        className={`metric-choice-button${form.communityGoalCountType === countType ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => updateField('communityGoalCountType', countType)}
                        aria-pressed={form.communityGoalCountType === countType}
                      >
                        {countTypeMeta.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="field">
                <span>{strings.communityGoalTargetLabel}</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.communityGoalTargetAmount}
                  onChange={(event) => updateField('communityGoalTargetAmount', event.target.value)}
                  placeholder="1200"
                />
              </label>

              <div className="event-meta-grid">
                <label className="field">
                  <span>{strings.bonusPointsLabel}</span>
                  <input
                    type="number"
                    min="0"
                    value={form.communityGoalBonusPoints}
                    onChange={(event) => updateField('communityGoalBonusPoints', event.target.value)}
                    placeholder="350"
                  />
                </label>

                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={form.communityGoalRegistrationRequired}
                    onChange={(event) => updateField('communityGoalRegistrationRequired', event.target.checked)}
                  />
                  <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                  <span className="toggle-help">{strings.registrationRequiredHelp}</span>
                </label>
              </div>

              <p className="field-help">{strings.communityGoalHelp}</p>
            </>
          ) : isRouteEventActive && routeEventConfig ? (
            <>
              <SettingsAccordionSection title={routeEventConfig.titleLabel} defaultOpen>
                <label className="field">
                  <span>{routeEventConfig.titleLabel}</span>
                  <input
                    type="text"
                    value={form[routeEventConfig.titleField]}
                    onChange={(event) => updateField(routeEventConfig.titleField, event.target.value)}
                    placeholder={routeEventConfig.titlePlaceholder}
                  />
                </label>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.tourLegsLabel} defaultOpen>
                <div className="field-group">
                  <label className="field">
                    <span>{strings.tourLegsLabel}</span>
                    <textarea
                      rows={5}
                      value={form[routeEventConfig.legsField]}
                      onChange={(event) => updateField(routeEventConfig.legsField, event.target.value)}
                      placeholder={strings.tourLegsPlaceholder}
                    />
                  </label>
                  <p className="field-help">{strings.tourLegsHelp}</p>
                </div>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={routeEventConfig.descriptionLabel} defaultOpen>
                <div className="field-group">
                  <label className="field tour-description-field">
                    <span>{routeEventConfig.descriptionLabel}</span>
                    <textarea
                      rows={3}
                      value={form[routeEventConfig.descriptionField]}
                      onChange={(event) => updateField(routeEventConfig.descriptionField, event.target.value)}
                      placeholder={routeEventConfig.descriptionPlaceholder}
                    />
                  </label>
                  <p className="field-help">{routeEventConfig.descriptionHelp}</p>
                </div>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.bonusPointsLabel} defaultOpen>
                <div className="settings-accordion-stack">
                  <label className="field">
                    <span>{strings.bonusPointsLabel}</span>
                    <input
                      type="number"
                      min="0"
                      value={form[routeEventConfig.bonusField]}
                      onChange={(event) => updateField(routeEventConfig.bonusField, event.target.value)}
                      placeholder="350"
                    />
                  </label>

                  <div className="event-meta-grid">
                    <label className="toggle-field">
                      <input
                        type="checkbox"
                        checked={form.vatsimEvent}
                        onChange={(event) => updateField('vatsimEvent', event.target.checked)}
                      />
                      <span className="toggle-title">{strings.vatsimEventLabel}</span>
                      <span className="toggle-help">{strings.vatsimEventHelp}</span>
                    </label>

                    <label className="toggle-field">
                      <input
                        type="checkbox"
                        checked={form[routeEventConfig.registrationField]}
                        onChange={(event) => updateField(routeEventConfig.registrationField, event.target.checked)}
                      />
                      <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                      <span className="toggle-help">{strings.registrationRequiredHelp}</span>
                    </label>
                  </div>
                </div>
              </SettingsAccordionSection>

              <SettingsAccordionSection title={strings.rewardTextLabel}>
                <div className="field-group">
                  <p className="field-help">{strings.rewardTextHelp}</p>

                  <div className="field-grid">
                    <label className="field">
                      <span>{strings.rewardTextPrefixLabel}</span>
                      <input
                        type="text"
                        value={form.rewardPrefixText}
                        onChange={(event) => updateField('rewardPrefixText', event.target.value)}
                        placeholder={strings.rewardPrefix}
                      />
                    </label>

                    <label className="field">
                      <span>{strings.rewardTextSuffixLabel}</span>
                      <input
                        type="text"
                        value={form.rewardSuffixText}
                        onChange={(event) => updateField('rewardSuffixText', event.target.value)}
                        placeholder={strings.rewardSuffix}
                      />
                    </label>
                  </div>
                </div>
              </SettingsAccordionSection>

              {eventType === 'curated-roster' || eventType === 'roster' ? (
                <SettingsAccordionSection title={strings.curatedRosterVisualLabel}>
                  <div className="field-group">
                    <div className="project-switcher" role="group" aria-label={strings.curatedRosterVisualLabel}>
                      <button
                        className={`project-button${(eventType === 'roster' ? form.rosterVisualMode : form.curatedRosterVisualMode) === 'map' ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => updateField(eventType === 'roster' ? 'rosterVisualMode' : 'curatedRosterVisualMode', 'map')}
                        aria-pressed={(eventType === 'roster' ? form.rosterVisualMode : form.curatedRosterVisualMode) === 'map'}
                      >
                        <span className="project-button-title">{strings.curatedRosterVisualMapLabel}</span>
                      </button>

                      <button
                        className={`project-button${(eventType === 'roster' ? form.rosterVisualMode : form.curatedRosterVisualMode) === 'aircraft' ? ' is-active' : ''}`}
                        type="button"
                        onClick={() => updateField(eventType === 'roster' ? 'rosterVisualMode' : 'curatedRosterVisualMode', 'aircraft')}
                        aria-pressed={(eventType === 'roster' ? form.rosterVisualMode : form.curatedRosterVisualMode) === 'aircraft'}
                      >
                        <span className="project-button-title">{strings.curatedRosterVisualAircraftLabel}</span>
                      </button>
                    </div>
                  </div>
                </SettingsAccordionSection>
              ) : null}

              {aircraftFieldConfig ? (
                <SettingsAccordionSection title={strings.aircraftAssignmentLabel} defaultOpen={form[aircraftFieldConfig.enabledField]}>
                <div className="field-group">
                  <label className="toggle-field toggle-field-wide">
                    <input
                      type="checkbox"
                      checked={form[aircraftFieldConfig.enabledField]}
                      onChange={(event) => toggleAircraftAssignment(event.target.checked)}
                    />
                    <span className="toggle-title">{strings.aircraftAssignmentLabel}</span>
                    <span className="toggle-help">{strings.aircraftAssignmentHelp}</span>
                  </label>

                  {form[aircraftFieldConfig.enabledField] ? (
                    <>
                      <p className="field-help">
                        {locale === 'ru'
                          ? 'Выбор самолёта строится по каталогу проекта: сначала авиакомпания, затем ICAO тип ВС, затем при необходимости конкретная регистрация.'
                          : 'Aircraft selection uses the project catalog: first choose the airline, then the ICAO type, and then a specific registration if needed.'}
                      </p>

                      {isSyncingAircraftCatalog ? (
                        <p className="field-help">
                          {locale === 'ru'
                            ? `Синхронизируем каталог ${activeAircraftSourceLabel}...`
                            : `Syncing the ${activeAircraftSourceLabel} aircraft catalog...`}
                        </p>
                      ) : isLoadingAircraftOptions ? (
                        <p className="field-help">{locale === 'ru' ? 'Ищем самолёты…' : 'Searching aircraft…'}</p>
                      ) : null}

                      {aircraftOptions.length > 0 ? (
                        <div className="field-group">
                          <span className="section-mini-title">
                            {strings.aircraftListLabel}: {activeAircraftSourceLabel}
                          </span>

                          <label className="field">
                            <span>{strings.aircraftAirlineFilterLabel}</span>
                            <select
                              className="aircraft-option-select"
                              value={selectedAircraftAirlineFilter}
                              onChange={(event) => handleAircraftAirlineChange(event.target.value)}
                              disabled={availableAircraftAirlineFilters.length <= 1}
                            >
                              <option value="all">{strings.aircraftAirlineFilterAllLabel}</option>
                              {availableAircraftAirlineFilters.filter((item) => item !== 'all').map((airline) => (
                                <option key={airline} value={airline}>
                                  {airline}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="aircraft-picker-grid">
                            <label className="field">
                              <span>{locale === 'ru' ? 'ICAO тип ВС' : 'Aircraft ICAO Type'}</span>
                              <select
                                className="aircraft-option-select"
                                value={selectedAircraftTypeValue}
                                onChange={(event) => handleAircraftTypeChange(event.target.value)}
                              >
                                <option value="">{locale === 'ru' ? 'Выберите ICAO тип ВС' : 'Select an aircraft ICAO type'}</option>
                                {availableAircraftTypeOptions.map((typeLabel) => (
                                  <option key={typeLabel} value={typeLabel}>
                                    {typeLabel}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>{strings.aircraftRegistrationLabel}</span>
                              <select
                                className="aircraft-option-select"
                                value={selectedAircraftRegistrationKey}
                                onChange={(event) => handleAircraftRegistrationChange(event.target.value)}
                                disabled={filteredAircraftRegistrationOptions.length === 0}
                              >
                                <option value="">
                                  {eventType === 'curated-roster'
                                    ? (locale === 'ru' ? 'Без конкретной регистрации' : 'No specific registration')
                                    : (locale === 'ru' ? 'Выберите регистрацию' : 'Select a registration')}
                                </option>
                                {filteredAircraftRegistrationOptions.map((option) => {
                                  const aircraftAirlineLabel = getAircraftAirlineLabel(option)
                                  const registrationLabel = [
                                    option.registration,
                                    aircraftAirlineLabel,
                                    getAircraftSourceLabel(option.source),
                                  ].filter(Boolean).join(' • ')

                                  return (
                                    <option
                                      key={`${option.source}-${option.aircraft_id ?? option.registration}`}
                                      value={`${option.source}:${option.registration}`}
                                    >
                                      {registrationLabel}
                                    </option>
                                  )
                                })}
                              </select>
                            </label>
                          </div>
                        </div>
                      ) : !isLoadingAircraftOptions && !isSyncingAircraftCatalog ? (
                        <p className="field-help">{strings.aircraftListEmpty}</p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                </SettingsAccordionSection>
              ) : null}
            </>
          ) : (
            <>
              <label className="field">
                <span>{strings.cityLabel}</span>
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => handleCityChange(event.target.value)}
                  placeholder="Saint Petersburg"
                />
              </label>

              {airportOptions.length > 0 ? (
                <div className="airport-options-list">
                  {airportOptions.map((option) => (
                    <button
                      key={option.icao}
                      className="airport-option-card"
                      type="button"
                      onClick={() => updateAirportFields(option)}
                    >
                      <span className="airport-option-meta">
                        <span className="airport-option-code">{option.icao}</span>
                        {option.iata ? <span className="airport-option-iata">{option.iata}</span> : null}
                      </span>
                      <span className="airport-option-name">{option.name}</span>
                      <span className="airport-option-city">
                        {option.city}
                        {option.countryCode ? `, ${option.countryCode}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className={`field-grid${eventType === 'focus-airport' ? ' field-grid-compact' : ''}`}>
                <label className="field">
                  <span>{strings.countryCodeLabel}</span>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.countryCode ?? ''}
                    onChange={(event) =>
                      updateField('countryCode', event.target.value.replace(/[^a-z]/gi, '').toUpperCase())
                    }
                    placeholder="RU"
                  />
                </label>

                <label className="field">
                  <span>{strings.icaoLabel}</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={form.icao}
                    onChange={(event) => handleIcaoChange(event.target.value)}
                    placeholder="ULLI"
                  />
                </label>

                {eventType === 'focus-airport' ? (
                  <label className="field">
                    <span>{strings.bonusPointsLabel}</span>
                    <input
                      type="number"
                      min="0"
                        value={form.focusBonusPoints}
                        onChange={(event) => updateField('focusBonusPoints', event.target.value)}
                      placeholder="350"
                    />
                  </label>
                ) : null}
              </div>

              <label className="field">
                <span>{strings.airportNameLabel}</span>
                <input
                  type="text"
                  value={form.airportName}
                  onChange={(event) => {
                    updateField('airportName', event.target.value)
                    setAirportOptions([])
                  }}
                  placeholder="Pulkovo"
                />
              </label>

              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={form.focusRegistrationRequired}
                  onChange={(event) => updateField('focusRegistrationRequired', event.target.checked)}
                />
                <span className="toggle-title">{strings.registrationRequiredLabel}</span>
                <span className="toggle-help">{strings.registrationRequiredHelp}</span>
              </label>
            </>
          )}
        </section>
        ) : (
        <section className="panel-card">
          <h2>{badgeStrings.settingsTitle}</h2>

          <SettingsAccordionSection title={badgeStrings.titleLabel} defaultOpen>
            <label className="field">
              <span>{badgeStrings.titleLabel}</span>
              <input
                type="text"
                value={badgeForm.title}
                onChange={(event) => updateBadgeField('title', event.target.value)}
                placeholder="Participant"
              />
            </label>

            <label className="field">
              <span>{badgeStrings.subtitleLabel}</span>
              <input
                type="text"
                value={badgeForm.subtitle}
                onChange={(event) => updateBadgeField('subtitle', event.target.value)}
                placeholder="Spring Event 2026"
              />
            </label>

            <label className="field">
              <span>{badgeStrings.topLabel}</span>
              <input
                type="text"
                value={badgeForm.topLabel}
                onChange={(event) => updateBadgeField('topLabel', event.target.value)}
                placeholder="EVENT"
              />
            </label>
          </SettingsAccordionSection>

          <SettingsAccordionSection title={badgeStrings.shapeLabel} defaultOpen>
            <div className="badge-choice-grid" role="group" aria-label={badgeStrings.shapeLabel}>
              {([
                ['circle', badgeStrings.shapeCircle],
                ['rounded-square', badgeStrings.shapeRoundedSquare],
                ['shield', badgeStrings.shapeShield],
              ] as Array<[BadgeShape, string]>).map(([shapeValue, shapeLabel]) => (
                <button
                  key={shapeValue}
                  className={`mini-choice-card${badgeForm.shape === shapeValue ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('shape', shapeValue)}
                  aria-pressed={badgeForm.shape === shapeValue}
                >
                  {shapeLabel}
                </button>
              ))}
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection title={badgeStrings.frameLabel} defaultOpen>
            <div className="badge-choice-grid" role="group" aria-label={badgeStrings.frameLabel}>
              {([
                ['ring', badgeStrings.frameRing],
                ['hex', badgeStrings.frameHex],
                ['ticket', badgeStrings.frameTicket],
              ] as Array<[BadgeFrame, string]>).map(([frameValue, frameLabel]) => (
                <button
                  key={frameValue}
                  className={`mini-choice-card${badgeForm.frame === frameValue ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('frame', frameValue)}
                  aria-pressed={badgeForm.frame === frameValue}
                >
                  {frameLabel}
                </button>
              ))}
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection title={badgeStrings.layerStyleLabel} defaultOpen>
            <div className="badge-choice-grid" role="group" aria-label={badgeStrings.layerStyleLabel}>
              {([
                ['orbital', badgeStrings.layerStyleOrbital],
                ['winged', badgeStrings.layerStyleWinged],
                ['crest', badgeStrings.layerStyleCrest],
              ] as Array<[BadgeLayerStyle, string]>).map(([layerValue, layerLabel]) => (
                <button
                  key={layerValue}
                  className={`mini-choice-card${badgeForm.layerStyle === layerValue ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('layerStyle', layerValue)}
                  aria-pressed={badgeForm.layerStyle === layerValue}
                >
                  {layerLabel}
                </button>
              ))}
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection title={badgeStrings.iconLabel} defaultOpen>
            <div className="badge-icon-grid" role="group" aria-label={badgeStrings.iconLabel}>
              {([
                ['medal', badgeStrings.iconMedal],
                ['aircraft', badgeStrings.iconAircraft],
                ['jet', badgeStrings.iconJet],
                ['airliner', badgeStrings.iconAirliner],
                ['prop', badgeStrings.iconProp],
                ['helicopter', badgeStrings.iconHelicopter],
                ['route', badgeStrings.iconRoute],
                ['globe', badgeStrings.iconGlobe],
                ['star', badgeStrings.iconStar],
                ['laurel', badgeStrings.iconLaurel],
                ['crown', badgeStrings.iconCrown],
                ['vatsim', badgeStrings.iconVatsim],
              ] as Array<[BadgeIcon, string]>).map(([iconValue, iconLabel]) => (
                <button
                  key={iconValue}
                  className={`badge-icon-button${badgeForm.icon === iconValue ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('icon', iconValue)}
                  aria-pressed={badgeForm.icon === iconValue}
                >
                  <span className="badge-icon-button-glyph">{renderBadgeIcon(iconValue)}</span>
                  <span>{iconLabel}</span>
                </button>
              ))}
            </div>
          </SettingsAccordionSection>

          <SettingsAccordionSection title={badgeStrings.paletteLabel} defaultOpen>
            <div className="settings-accordion-stack">
              <div className="badge-choice-grid" role="group" aria-label={badgeStrings.paletteModeLabel}>
                <button
                  className={`mini-choice-card${badgeForm.paletteMode === 'brand' ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('paletteMode', 'brand')}
                  aria-pressed={badgeForm.paletteMode === 'brand'}
                >
                  {badgeStrings.paletteModeBrand}
                </button>
                <button
                  className={`mini-choice-card${badgeForm.paletteMode === 'custom' ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => updateBadgeField('paletteMode', 'custom')}
                  aria-pressed={badgeForm.paletteMode === 'custom'}
                >
                  {badgeStrings.paletteModeCustom}
                </button>
              </div>

              <p className="field-help">{badgeStrings.paletteModeHelp}</p>

              {badgeForm.paletteMode === 'custom' ? (
                <div className="field-grid">
                  <label className="field">
                    <span>{badgeStrings.bgColorLabel}</span>
                    <input type="color" value={badgeForm.backgroundColor} onChange={(event) => updateBadgeField('backgroundColor', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>{badgeStrings.accentColorLabel}</span>
                    <input type="color" value={badgeForm.accentColor} onChange={(event) => updateBadgeField('accentColor', event.target.value)} />
                  </label>
                  <label className="field">
                    <span>{badgeStrings.textColorLabel}</span>
                    <input type="color" value={badgeForm.textColor} onChange={(event) => updateBadgeField('textColor', event.target.value)} />
                  </label>
                </div>
              ) : (
                <div className="badge-brand-palette-preview">
                  <span className="badge-brand-palette-swatch" style={{ backgroundColor: activeBadgeBrandPalette.backgroundColor }}></span>
                  <span className="badge-brand-palette-swatch" style={{ backgroundColor: activeBadgeBrandPalette.accentColor }}></span>
                  <span className="badge-brand-palette-swatch" style={{ backgroundColor: activeBadgeBrandPalette.textColor }}></span>
                </div>
              )}
            </div>
          </SettingsAccordionSection>
        </section>
        )}

      </aside>

      <main className="preview-panel">
        <div className="preview-header">
          <div>
            <span className="preview-label">{strings.previewLabel}</span>
            <h2>{previewTitleText}</h2>
          </div>
          <span className="resolution-chip">{previewResolutionChip}</span>
        </div>

        <div className="preview-frame">
          <div ref={previewViewportRef} className="banner-preview-viewport">
            <div
              className="banner-preview-stage"
              style={{
                width: `${previewBaseWidth * previewScale}px`,
                height: `${previewBaseHeight * previewScale}px`,
              }}
            >
              <div
                className="banner-preview-scale"
                style={{
                  transform: `scale(${previewScale})`,
                }}
              >
                {isBadgeMode ? (
                  <div
                    ref={previewRef}
                    className={`badge-preview is-${badgeForm.shape} has-${badgeForm.frame}-frame is-${badgeForm.layerStyle}`}
                    style={
                      {
                        '--badge-bg': effectiveBadgePalette.backgroundColor,
                        '--badge-accent': effectiveBadgePalette.accentColor,
                        '--badge-text': effectiveBadgePalette.textColor,
                      } as React.CSSProperties
                    }
                  >
                    <div className="badge-preview-core">
                      <div className="badge-preview-topline">{badgeForm.topLabel.trim() || 'EVENT'}</div>
                      <div className="badge-preview-frame-layer" aria-hidden="true"></div>
                      <div className="badge-preview-ring"></div>
                      <div className="badge-preview-glow"></div>
                      <div className="badge-preview-ornament badge-preview-ornament-left" aria-hidden="true"></div>
                      <div className="badge-preview-ornament badge-preview-ornament-right" aria-hidden="true"></div>
                      <div className="badge-preview-gridline badge-preview-gridline-horizontal" aria-hidden="true"></div>
                      <div className="badge-preview-gridline badge-preview-gridline-vertical" aria-hidden="true"></div>
                      <div className="badge-preview-icon">{renderBadgeIcon(badgeForm.icon)}</div>
                      <div className="badge-preview-copy">
                        <strong>{badgeForm.title.trim() || 'Participant'}</strong>
                        {badgeForm.subtitle.trim() ? <span>{badgeForm.subtitle.trim()}</span> : null}
                      </div>
                      <div className="badge-preview-brand">
                        {brandKey === 'rag' ? 'RAG' : 'vNWS'}
                      </div>
                    </div>
                  </div>
                ) : (
                <div
                  ref={previewRef}
                  className={`banner-preview${backgroundUrl ? ' has-photo' : ''}${isMapEventActive ? ' is-tour' : ''}${isComplexEventActive ? ' is-complex-event' : ''}${isVatsimRegionEventActive ? ' is-vatsim-region' : ''}${isCommunityEventActive ? ' is-community-event' : ''}${eventType === 'community-goal' ? ' is-community-goal' : ''} is-${eventType}${shouldShowAircraftPhotoVisual ? ' has-aircraft-photo' : ''}${isSpecificAircraftMode ? ' is-aircraft-focus' : ''}${isMapEventActive ? ` map-theme-${activeMapTheme}` : ''}`}
                  style={bannerBackground}
                  >
                    <div className="banner-minimal-fallback" aria-hidden="true"></div>

                    {eventType === 'community-goal' ? (
                      <div className="banner-theme-layer" aria-hidden="true">
                        <svg className="banner-theme-lines" viewBox="0 0 1920 1080" preserveAspectRatio="none">
                          <path className="banner-theme-route-line is-primary" d="M1010 238 C1234 146 1518 178 1736 86" />
                          <path className="banner-theme-route-line is-secondary" d="M1098 704 C1294 584 1510 606 1778 452" />
                          <path className="banner-theme-route-line is-tertiary" d="M826 916 C1114 820 1342 868 1664 746" />
                          <circle className="banner-theme-node is-primary" cx="1010" cy="238" r="9" />
                          <circle className="banner-theme-node" cx="1736" cy="86" r="7" />
                          <circle className="banner-theme-node" cx="1098" cy="704" r="7" />
                          <circle className="banner-theme-node" cx="1778" cy="452" r="7" />
                          <circle className="banner-theme-node" cx="1664" cy="746" r="7" />
                        </svg>

                        <div className="banner-theme-radar">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>

                        <div className="banner-theme-panel">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    ) : null}

                    {shouldShowAircraftPhotoVisual ? (
                      <div
                        className="banner-aircraft-photo-layer is-manual-draggable"
                        style={{
                          backgroundImage: `url(${activeAircraftPhotoUrl})`,
                          '--aircraft-photo-size': effectiveAircraftPhotoLayout.size,
                          '--aircraft-photo-position-x': effectiveAircraftPhotoLayout.positionX,
                          '--aircraft-photo-position-y': effectiveAircraftPhotoLayout.positionY,
                        } as React.CSSProperties}
                        onPointerDown={handleAircraftPhotoPointerDown}
                        onPointerMove={handleAircraftPhotoPointerMove}
                        onPointerUp={handleAircraftPhotoPointerEnd}
                        onPointerCancel={handleAircraftPhotoPointerEnd}
                      aria-hidden="true"
                    ></div>
                  ) : null}

                  {(eventType === 'curated-roster' || eventType === 'roster') && isSpecificAircraftMode ? (
                    <div className="banner-curated-story-layer" aria-hidden="true"></div>
                  ) : null}

                  {isMapEventActive && !isSpecificAircraftMode ? (
                    <TourRouteMap
                      legs={displayedRouteLegPairs}
                      showFlags={showLegFlags}
                      showLegend={isComplexEventActive}
                      highlightedRegionOverlays={isVatsimRegionEventActive ? selectedVatsimRegionOverlays : []}
                      detailRegionOverlays={isVatsimRegionEventActive && activeMapDetailMode === 'fir-tma' ? selectedVatsimRegionTraconOverlays : []}
                      zoomPercent={activeMapZoom}
                      panOffsetX={activeMapOffsetX}
                      panOffsetY={activeMapOffsetY}
                      isInteractive={canShowPreviewMapTools}
                      onPointerDown={handleMapPointerDown}
                      onPointerMove={handleMapPointerMove}
                      onPointerUp={handleMapPointerEnd}
                      onPointerCancel={handleMapPointerEnd}
                    />
                  ) : null}

                  <div className="banner-layout">
                      <div
                        className={`banner-copy${isMapEventActive ? ' is-tour' : ''}${isComplexEventActive ? ' is-complex-event' : ''}${isVatsimRegionEventActive ? ' is-vatsim-region' : ''}${isCommunityEventActive ? ' is-community-event' : ''}${isSpecificAircraftMode ? ' is-aircraft-focus' : ''}`}
                    >
                      <div className="banner-kicker-row">
                        {showCombinedVatsimBadge ? (
                          <div className="banner-kicker-combined">
                            <span className="banner-kicker-combined-primary">{bannerActiveEventName}</span>
                            <span className="banner-kicker-combined-secondary">{bannerStrings.vatsimEventBadge}</span>
                          </div>
                        ) : (
                          <div className="banner-kicker">{bannerKickerLabel}</div>
                        )}
                      </div>

                      <div className="banner-title">
                        {titleLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>

                      {isVatsimRegionEventActive ? (
                        <>
                          {vatsimRegionDescription ? <p className="banner-tour-intro">{vatsimRegionDescription}</p> : null}

                          <div className="banner-vatsim-region-meta">
                            {vatsimRegionUnitLabels.map((label) => (
                              <span key={`unit-${label}`} className="banner-tour-summary-chip is-vatsim-hosts">{label}</span>
                            ))}
                            {vatsimRegionDivisionLabels.map((label) => (
                              <span key={`division-${label}`} className="banner-tour-summary-chip is-vatsim-partners">{label}</span>
                            ))}
                          </div>
                        </>
                      ) : isComplexEventActive ? (
                        <>
                          {complexEventDescription ? <p className="banner-tour-intro">{complexEventDescription}</p> : null}

                          <div className="banner-tour-summary banner-tour-summary-complex">
                            <span className="banner-tour-summary-chip">vNWS: {complexVnwsLegPairs.length}</span>
                            <span className="banner-tour-summary-chip">RAG: {complexRagLegPairs.length}</span>
                            <span className="banner-tour-summary-chip">{displayedRouteStops.length} stops</span>
                          </div>
                        </>
                      ) : isRouteEventActive ? (
                        <>
                          {routeBriefingText ? <p className="banner-tour-intro">{routeBriefingText}</p> : null}

                          {!isSpecificAircraftMode ? (
                            <div className="banner-tour-summary">
                              <span className="banner-tour-summary-chip">
                                {bannerStrings.tourLegsLabel}: {parsedRouteLegPairs.length}
                              </span>
                              <span className="banner-tour-summary-chip">
                                {bannerStrings.tourStopsLabel}: {routeStops.length}
                              </span>
                            </div>
                          ) : null}

                          {activeAircraftEnabled && (routeAircraftRegistration || activeAircraftName) ? (
                            <div className="banner-aircraft-assignment">
                              {activeAircraftName ? <span className="banner-aircraft-name">{activeAircraftName}</span> : null}
                              {routeAircraftRegistration ? <span className="banner-aircraft-registration">{routeAircraftRegistration}</span> : null}
                            </div>
                          ) : null}

                          {(eventType === 'roster' || eventType === 'curated-roster') && isSpecificAircraftMode && parsedRouteLegs.length > 0 ? (
                            <div className="banner-aircraft-legs">
                              <span className="banner-aircraft-legs-label">{bannerRouteEventConfig?.previewLabel}</span>
                              <div className="banner-legs-list">
                                {visibleAircraftFocusLegs.length > 0 ? (
                                  <>
                                    {visibleAircraftFocusLegs.map((leg, index) => (
                                      <span key={`${leg}-${index}`} className="banner-leg-chip">
                                        {leg}
                                      </span>
                                    ))}
                                    {hiddenAircraftFocusLegCount > 0 ? (
                                      <span className="banner-leg-chip is-overflow-summary">+{hiddenAircraftFocusLegCount}</span>
                                    ) : null}
                                    <span className="banner-leg-chip is-overflow-summary">{routeStops.length} airports</span>
                                    <span className="banner-leg-chip is-overflow-summary">{parsedRouteLegs.length} legs</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="banner-leg-chip is-overflow-summary">{routeStops.length} airports</span>
                                    <span className="banner-leg-chip is-overflow-summary">{parsedRouteLegs.length} legs</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : eventType === 'community-challenge' ? (
                        <p className="banner-challenge-intro">{bannerStrings.communityPreviewIntro}</p>
                      ) : eventType === 'community-goal' ? (
                        <p className="banner-challenge-intro">{communityGoalDescription}</p>
                      ) : (
                        <div className="banner-airport-chip">
                          <span className="banner-airport-flag" aria-hidden="true">
                            {countryFlagCode ? (
                              <span className={`fi fi-${countryFlagCode}`}></span>
                            ) : (
                              <span className="banner-airport-flag-fallback">{normalizedCountryCode}</span>
                            )}
                          </span>
                          <span className="banner-airport-name">{normalizedAirportName}</span>
                          <strong className="banner-airport-icao">{normalizedIcao}</strong>
                        </div>
                      )}

                      {eventType === 'focus-airport' || isComplexEventActive || isVatsimRegionEventActive ? (
                        <div className="banner-pill-row">
                          {!isComplexEventActive && registrationRequired ? <div className="banner-registration-pill">{bannerStrings.registrationRequiredBadge}</div> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className={`banner-footer${isCommunityEventActive ? ' is-community-event' : ''}`}>
                      <div
                        className={`banner-reward-block${isMapEventActive ? ' is-tour' : ''}${isComplexEventActive ? ' is-complex-event' : ''}${isVatsimRegionEventActive ? ' is-vatsim-region' : ''}${isCommunityEventActive ? ' is-community-event' : ''}${eventType === 'community-goal' ? ' is-community-goal' : ''}${isSpecificAircraftMode ? ' is-aircraft-focus' : ''}`}
                      >
                        {!isVatsimRegionEventActive ? (
                          <span className="banner-reward-label">
                            {isComplexEventActive
                              ? bannerStrings.complexEventPreviewLabel
                              : isSpecificAircraftMode
                              ? bannerStrings.rewardLabel
                              : isRouteEventActive && bannerRouteEventConfig
                              ? bannerRouteEventConfig.previewLabel
                              : eventType === 'community-challenge'
                                ? bannerStrings.communityPreviewLabel
                                : eventType === 'community-goal'
                                  ? bannerStrings.communityGoalPreviewLabel
                                : bannerStrings.rewardLabel}
                          </span>
                        ) : null}

                        {isVatsimRegionEventActive ? (
                          vatsimRegionMapLegs.length > 0 ? (
                            <div className="banner-vatsim-region-stack">
                              <div className="banner-tour-summary banner-tour-summary-vatsim-compact">
                                <span className="banner-tour-summary-chip">{vatsimRegionTotalLegCount} legs</span>
                                <span className="banner-tour-summary-chip">{vatsimRegionRouteStops.length} stops</span>
                              </div>

                              <div className="banner-legs-list banner-legs-list-vatsim-compact">
                                {vatsimRegionCompactLegEntries.map((entry, index) => (
                                  <span key={`${entry.tone}-${entry.leg}-${index}`} className={`banner-leg-chip is-${entry.tone}`}>
                                    {entry.leg}
                                  </span>
                                ))}
                                {vatsimRegionHiddenLegCount > 0 ? (
                                  <span className="banner-leg-chip is-overflow-summary">+{vatsimRegionHiddenLegCount}</span>
                                ) : null}
                              </div>

                              <div className={`banner-reward-value${rewardUsesCustomCompactLayout ? ' is-compact' : ''}`}>
                                {rewardLeadText ? <span>{rewardLeadText}</span> : null}
                                <em>{normalizedBonusPoints}</em>
                                {rewardTailText ? <span>{rewardTailText}</span> : null}
                              </div>
                            </div>
                          ) : (
                            <div className="banner-legs-empty">{bannerStrings.vatsimRegionPreviewEmpty}</div>
                          )
                        ) : isComplexEventActive ? (
                          complexMapLegs.length > 0 ? (
                            <div className="banner-complex-grid">
                              <article className="banner-complex-card is-vnws">
                                <div className="banner-complex-card-header">
                                  <div>
                                    <span className="banner-complex-card-kicker">vNWS</span>
                                    <strong className="banner-complex-card-title">{complexVnwsLegPairs.length} legs</strong>
                                  </div>
                                  <span className="banner-complex-card-summary">{getTourStops(complexVnwsLegPairs).length} stops</span>
                                </div>

                                <div className="banner-legs-list banner-legs-list-complex">
                                  {complexVisibleVnwsLegs.map((leg, index) => (
                                    <span key={`${leg}-${index}`} className="banner-leg-chip is-vnws">{leg}</span>
                                  ))}
                                  {complexHiddenVnwsLegCount > 0 ? (
                                    <span className="banner-leg-chip is-overflow-summary">+{complexHiddenVnwsLegCount}</span>
                                  ) : null}
                                </div>

                                <div className="banner-complex-card-reward">
                                  <strong>{form.complexEventVnwsBonusPoints.trim() || '0'}</strong>
                                  <span>{bannerStrings.rewardSuffix}</span>
                                </div>

                                {form.complexEventVnwsRegistrationRequired ? (
                                  <div className="banner-meta-card is-registration">
                                    <strong className="banner-meta-card-value">{bannerStrings.registrationRequiredBadge}</strong>
                                  </div>
                                ) : null}
                              </article>

                              <article className="banner-complex-card is-rag">
                                <div className="banner-complex-card-header">
                                  <div>
                                    <span className="banner-complex-card-kicker">RAG</span>
                                    <strong className="banner-complex-card-title">{complexRagLegPairs.length} legs</strong>
                                  </div>
                                  <span className="banner-complex-card-summary">{getTourStops(complexRagLegPairs).length} stops</span>
                                </div>

                                <div className="banner-legs-list banner-legs-list-complex">
                                  {complexVisibleRagLegs.map((leg, index) => (
                                    <span key={`${leg}-${index}`} className="banner-leg-chip is-rag">{leg}</span>
                                  ))}
                                  {complexHiddenRagLegCount > 0 ? (
                                    <span className="banner-leg-chip is-overflow-summary">+{complexHiddenRagLegCount}</span>
                                  ) : null}
                                </div>

                                <div className="banner-complex-card-reward">
                                  <strong>{form.complexEventRagBonusPoints.trim() || '0'}</strong>
                                  <span>{bannerStrings.rewardSuffix}</span>
                                </div>

                                {form.complexEventRagRegistrationRequired ? (
                                  <div className="banner-meta-card is-registration">
                                    <strong className="banner-meta-card-value">{bannerStrings.registrationRequiredBadge}</strong>
                                  </div>
                                ) : null}
                              </article>
                            </div>
                          ) : (
                            <div className="banner-legs-empty">{bannerStrings.complexEventPreviewEmpty}</div>
                          )
                        ) : isSpecificAircraftMode ? (
                          <div className={`banner-reward-value${rewardUsesCustomCompactLayout ? ' is-compact' : ''}`}>
                            {rewardLeadText ? <span>{rewardLeadText}</span> : null}
                            <em>{normalizedBonusPoints}</em>
                            {rewardTailText ? <span>{rewardTailText}</span> : null}
                          </div>
                        ) : isRouteEventActive && bannerRouteEventConfig ? (
                          parsedRouteLegs.length > 0 ? (
                            <div className="banner-legs-list">
                              {useCompactBannerLegSummary ? (
                                <>
                                  <span className="banner-leg-chip">{parsedRouteLegs.length} legs</span>
                                  <span className="banner-leg-chip">{routeStops.length} stops</span>
                                  {compactRouteSummary ? (
                                    <span className="banner-leg-chip is-overflow-summary">{compactRouteSummary}</span>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  {visibleBannerLegs.map((leg, index) => {
                                    if (showLegFlags) {
                                      const dashIdx = leg.indexOf(' - ')
                                      const from = dashIdx !== -1 ? leg.substring(0, dashIdx) : leg
                                      const to = dashIdx !== -1 ? leg.substring(dashIdx + 3) : ''
                                      const fromFlag = getFlagAssetCode(getIcaoCountryCode(from))
                                      const toFlag = getFlagAssetCode(getIcaoCountryCode(to))
                                      return (
                                        <span key={`${leg}-${index}`} className="banner-leg-chip">
                                          {fromFlag && <span className={`fi fi-${fromFlag} banner-leg-flag`}></span>}
                                          {from}
                                          {to ? ' - ' : ''}
                                          {to && toFlag && <span className={`fi fi-${toFlag} banner-leg-flag`}></span>}
                                          {to}
                                        </span>
                                      )
                                    }
                                    return (
                                      <span key={`${leg}-${index}`} className="banner-leg-chip">
                                        {leg}
                                      </span>
                                    )
                                  })}
                                  {hiddenBannerLegCount > 0 ? (
                                    <span className="banner-leg-chip is-overflow-summary">+{hiddenBannerLegCount}</span>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="banner-legs-empty">{bannerRouteEventConfig?.previewEmpty}</div>
                          )
                        ) : eventType === 'community-challenge' ? (
                          bannerCommunityTeams.length > 0 ? (
                            <div className="banner-team-grid">
                              {bannerCommunityTeams.map((team) => (
                                <article key={team.id} className="banner-team-card">
                                  <div className="banner-team-name">{team.name}</div>
                                  <div className="banner-team-goal">{team.goalLabel}</div>
                                  <div className="banner-team-target">
                                    <strong>{team.targetLabel}</strong>
                                    <span>{team.unitLabel}</span>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="banner-legs-empty">{bannerStrings.communityPreviewEmpty}</div>
                          )
                        ) : eventType === 'community-goal' ? (
                          <div className="banner-goal-card">
                            <div className="banner-goal-type">{bannerCommunityGoalCountTypeMeta.label}</div>
                            <div className="banner-goal-target">
                              <strong>{bannerFormattedCommunityGoalTarget}</strong>
                              <span>{bannerCommunityGoalCountTypeMeta.unit}</span>
                            </div>
                            <p className="banner-goal-note">{bannerStrings.communityGoalHelp}</p>
                          </div>
                        ) : (
                          <div className={`banner-reward-value${rewardUsesCustomCompactLayout ? ' is-compact' : ''}`}>
                            {rewardLeadText ? <span>{rewardLeadText}</span> : null}
                            <em>{normalizedBonusPoints}</em>
                            {rewardTailText ? <span>{rewardTailText}</span> : null}
                          </div>
                        )}

                        {eventType !== 'focus-airport' && !isComplexEventActive && !isVatsimRegionEventActive ? (
                          <div className="banner-meta-stack">
                            {registrationRequired ? (
                              <div className="banner-meta-card is-registration">
                                <strong className="banner-meta-card-value">{bannerStrings.registrationRequiredBadge}</strong>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className={`banner-logo-block${brandKey === 'rag' ? ' is-rag' : ''}${isDualProjectEventActive ? ' is-dual' : ''}`}
                        style={{ '--logo-overlay-opacity': logoOverlayOpacity } as React.CSSProperties}
                      >
                        {isDualProjectEventActive ? (
                          <DualProjectLogo ariaLabel={logoAriaLabel} />
                        ) : (
                          <ProjectLogo brandKey={brandKey} ariaLabel={logoAriaLabel} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {canShowPreviewPhotoTools ? (
                  <div className="preview-photo-tools">
                    <button
                      className={`preview-photo-tools-trigger${isPreviewPhotoToolsOpen ? ' is-open' : ''}`}
                      type="button"
                      onClick={() => setIsPreviewPhotoToolsOpen((current) => !current)}
                      aria-expanded={isPreviewPhotoToolsOpen}
                      aria-label={strings.previewPhotoToolsOpenLabel}
                    >
                      <GearIcon />
                    </button>

                    {isPreviewPhotoToolsOpen ? (
                      <div className="preview-photo-tools-panel">
                        <div className="preview-photo-tools-header">
                          <div>
                            <span className="section-mini-title">{strings.previewPhotoToolsLabel}</span>
                            <p className="field-help">{strings.previewPhotoToolsHint}</p>
                          </div>

                          <button
                            className="ghost-button preview-photo-tools-reset"
                            type="button"
                            onClick={resetAircraftPhotoFraming}
                          >
                            {strings.previewPhotoResetButton}
                          </button>
                        </div>

                        <p className="field-help preview-photo-tools-drag-hint">{strings.previewPhotoDragHint}</p>

                        <div className="preview-photo-tools-grid">
                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.aircraftPhotoOffsetXLabel}</span>
                              <span className="range-control-value">{Math.round(activeAircraftPhotoOffsetX)}%</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min="-30"
                              max="30"
                              step="1"
                              value={form[aircraftFieldConfig!.photoOffsetXField]}
                              onChange={(event) => updateField(aircraftFieldConfig!.photoOffsetXField, event.target.value)}
                            />
                          </label>

                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.aircraftPhotoOffsetYLabel}</span>
                              <span className="range-control-value">{Math.round(activeAircraftPhotoOffsetY)}%</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min="-30"
                              max="30"
                              step="1"
                              value={form[aircraftFieldConfig!.photoOffsetYField]}
                              onChange={(event) => updateField(aircraftFieldConfig!.photoOffsetYField, event.target.value)}
                            />
                          </label>

                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.aircraftPhotoZoomLabel}</span>
                              <span className="range-control-value">{Math.round(activeAircraftPhotoZoom)}%</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min="70"
                              max="170"
                              step="1"
                              value={form[aircraftFieldConfig!.photoZoomField]}
                              onChange={(event) => updateField(aircraftFieldConfig!.photoZoomField, event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {canShowPreviewMapTools ? (
                  <div className="preview-photo-tools">
                    <button
                      className={`preview-photo-tools-trigger${isPreviewMapToolsOpen ? ' is-open' : ''}`}
                      type="button"
                      onClick={() => setIsPreviewMapToolsOpen((current) => !current)}
                      aria-expanded={isPreviewMapToolsOpen}
                      aria-label={strings.previewMapToolsOpenLabel}
                    >
                      <GearIcon />
                    </button>

                    {isPreviewMapToolsOpen ? (
                      <div className="preview-photo-tools-panel">
                        <div className="preview-photo-tools-header">
                          <div>
                            <span className="section-mini-title">{strings.previewMapToolsLabel}</span>
                            <p className="field-help">{strings.previewMapToolsHint}</p>
                          </div>

                          <button
                            className="ghost-button preview-photo-tools-reset"
                            type="button"
                            onClick={resetMapView}
                          >
                            {strings.previewMapResetButton}
                          </button>
                        </div>

                        <p className="field-help preview-photo-tools-drag-hint">{strings.previewMapPanHint}</p>

                        <div className="preview-photo-tools-grid">
                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.previewMapZoomLabel}</span>
                              <span className="range-control-value">{Math.round(activeMapZoom)}%</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min="60"
                              max="320"
                              step="1"
                              value={String(activeMapZoom)}
                              onChange={(event) => updateField('mapZoom', event.target.value)}
                            />
                          </label>

                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.previewMapOffsetXLabel}</span>
                              <span className="range-control-value">{activeMapOffsetX > 0 ? '+' : ''}{Math.round(activeMapOffsetX)}</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min={String(-activeMapPanLimits.maxOffsetX)}
                              max={String(activeMapPanLimits.maxOffsetX)}
                              step="1"
                              value={String(activeMapOffsetX)}
                              onChange={(event) => updateField('mapOffsetX', event.target.value)}
                            />
                          </label>

                          <label className="range-control">
                            <span className="range-control-header">
                              <span>{strings.previewMapOffsetYLabel}</span>
                              <span className="range-control-value">{activeMapOffsetY > 0 ? '+' : ''}{Math.round(activeMapOffsetY)}</span>
                            </span>
                            <input
                              className="range-control-input"
                              type="range"
                              min={String(-activeMapPanLimits.maxOffsetY)}
                              max={String(activeMapPanLimits.maxOffsetY)}
                              step="1"
                              value={String(activeMapOffsetY)}
                              onChange={(event) => updateField('mapOffsetY', event.target.value)}
                            />
                          </label>

                          <div className="field-group">
                            <span className="section-mini-title">{strings.previewMapDetailLabel}</span>
                            <div className="project-switcher" role="group" aria-label={strings.previewMapDetailLabel}>
                              <button
                                className={`mini-choice-card${activeMapDetailMode === 'fir' ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => updateField('mapDetailMode', 'fir')}
                                aria-pressed={activeMapDetailMode === 'fir'}
                              >
                                {strings.previewMapDetailFirLabel}
                              </button>
                              <button
                                className={`mini-choice-card${activeMapDetailMode === 'fir-tma' ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => updateField('mapDetailMode', 'fir-tma')}
                                aria-pressed={activeMapDetailMode === 'fir-tma'}
                              >
                                {strings.previewMapDetailFirTmaLabel}
                              </button>
                            </div>
                          </div>

                          <div className="field-group">
                            <span className="section-mini-title">{strings.previewMapThemeLabel}</span>
                            <div className="project-switcher" role="group" aria-label={strings.previewMapThemeLabel}>
                              <button
                                className={`mini-choice-card${activeMapTheme === 'classic' ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => updateField('mapTheme', 'classic')}
                                aria-pressed={activeMapTheme === 'classic'}
                              >
                                {strings.previewMapThemeClassicLabel}
                              </button>
                              <button
                                className={`mini-choice-card${activeMapTheme === 'steel' ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => updateField('mapTheme', 'steel')}
                                aria-pressed={activeMapTheme === 'steel'}
                              >
                                {strings.previewMapThemeSteelLabel}
                              </button>
                              <button
                                className={`mini-choice-card${activeMapTheme === 'aurora' ? ' is-active' : ''}`}
                                type="button"
                                onClick={() => updateField('mapTheme', 'aurora')}
                                aria-pressed={activeMapTheme === 'aurora'}
                              >
                                {strings.previewMapThemeAuroraLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {vatsimRegionCoordinationSection ? (
          <section className="panel-card">
            {vatsimRegionCoordinationSection}
          </section>
        ) : null}

        <div className="preview-support-grid">
          {!isBadgeMode ? (
            <section className={`panel-card support-card${eventType === 'community-challenge' ? ' support-card-community' : ''}`}>
              {eventType === 'community-challenge' ? (
                <>
                  <div className="support-card-section">
                    <div className="support-card-heading">
                      <h2>{strings.communityTeamsTitle}</h2>
                      <p>{strings.communityTeamsHelp}</p>
                    </div>

                    {communityTeamsEditor}
                  </div>

                  <div className="support-card-divider"></div>

                  <div className="support-card-section">
                    <h3 className="support-card-subtitle">{strings.imagesTitle}</h3>
                    {imageAndLogoControls}
                  </div>
                </>
              ) : (
                <>
                  <h2>{strings.imagesTitle}</h2>
                  {imageAndLogoControls}
                </>
              )}
            </section>
          ) : (
            <section className="panel-card support-card">
              <h2>{badgeStrings.settingsTitle}</h2>
              <p>{badgeStrings.exportHelp}</p>
            </section>
          )}

          <section className="panel-card panel-actions support-card support-card-export">
            <div>
              <h2>{strings.exportTitle}</h2>
              <p>{isBadgeMode ? badgeStrings.exportHelp : strings.exportHelp}</p>
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={exportCurrentPreview}
              disabled={isExporting || isSavingSiteAsset || isAutoSelectingBackground || isApplyingFavoriteBackground}
            >
              {isExporting
                ? (isBadgeMode ? badgeStrings.exportingButton : strings.exportingButton)
                : (isBadgeMode ? badgeStrings.exportButton : strings.exportPngButton)}
            </button>

            {!isBadgeMode ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => void saveBannerToSiteAssets()}
                disabled={isExporting || isSavingSiteAsset || isAutoSelectingBackground || isApplyingFavoriteBackground}
              >
                {isSavingSiteAsset
                  ? (locale === 'ru' ? 'Сохраняем в сайт…' : 'Saving to site…')
                  : (locale === 'ru' ? 'Сохранить в ассеты сайта' : 'Save to site assets')}
              </button>
            ) : null}

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
            {siteAssetMessage ? <p className="success-text">{siteAssetMessage}</p> : null}
            {siteAssetUrl ? <p className="field-help asset-link-output">{siteAssetUrl}</p> : null}
          </section>
        </div>

        <footer className="app-footer">
          <a className="app-footer-link" href="https://twitch.tv/sebadavinch" target="_blank" rel="noreferrer">
            Nordwind Virtual (c) 2026
            <span>Developed by Grigorii - NWS0001</span>
          </a>
        </footer>
      </main>

      {isGuideOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsGuideOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label={guideStrings.title} onClick={(event) => event.stopPropagation()}>
            <div className="modal-card-header">
              <h2>{guideStrings.title}</h2>
              <button className="ghost-button" type="button" onClick={() => setIsGuideOpen(false)}>
                {guideStrings.close}
              </button>
            </div>
            <div className="modal-card-body">
              <p>{guideStrings.intro}</p>
              <p>{guideStrings.complexEvent}</p>
              <p>{guideStrings.vatsimRegion}</p>
              <p>{guideStrings.focusAirport}</p>
              <p>{guideStrings.tour}</p>
              <p>{guideStrings.roster}</p>
              <p>{guideStrings.curatedRoster}</p>
              <p>{guideStrings.communityChallenge}</p>
              <p>{guideStrings.communityGoal}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isArchiveOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsArchiveOpen(false)}>
          <div className="modal-card modal-card-archive" role="dialog" aria-modal="true" aria-label={guideStrings.archiveTitle} onClick={(event) => event.stopPropagation()}>
            <div className="modal-card-header">
              <h2>{guideStrings.archiveTitle}</h2>
              <button className="ghost-button" type="button" onClick={() => setIsArchiveOpen(false)}>
                {guideStrings.close}
              </button>
            </div>
            <div className="modal-card-body">
              {archiveError ? <p className="error-text">{archiveError}</p> : null}

              {archiveItems.length > 0 ? (
                <div className="archive-grid">
                  {archiveItems.map((item) => (
                    <article key={item.id} className="archive-card">
                      {item.image_url ? (
                        <span
                          className="archive-card-image"
                          style={{
                            backgroundImage: `linear-gradient(180deg, rgba(10, 12, 16, 0.04), rgba(10, 12, 16, 0.28)), url(${item.image_url})`,
                          }}
                          aria-hidden="true"
                        ></span>
                      ) : null}
                      <strong>{item.title}</strong>
                      <span>{item.event_type}</span>
                      <span>{item.brand}</span>
                      {item.description ? <p>{item.description}</p> : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p>{guideStrings.archiveEmpty}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
