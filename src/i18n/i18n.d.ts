import "i18next"
import common from "./messages/en/_common/common.json"
import nav from "./messages/en/_nav/nav.json"
import pageMeta from "./messages/en/_pageMeta/pageMeta.json"
import home from "./messages/en/__pages/Home.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common"
    resources: {
      common: typeof common
      nav: typeof nav
      pageMeta: typeof pageMeta
      home: typeof home
    }
  }
}