'use strict'

const fs = require('fs')
const path = require('path')
const semver = require('semver')
const camelcase = require('camelcase')
const publishRelease = require('publish-release')
const { paragraph } = require('txtgen')
const { token } = require('./secrets.json')
const pkg = require('./package.json')
const { name, version: oldVersion } = pkg

const releaseTypes = [
  `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`
]
const randomValFromArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }

  return array[0]
}

const releaseType = randomValFromArray(releaseTypes)

const version = pkg.version = semver.inc(oldVersion, releaseType)
const assetsDir = path.join(__dirname, 'assets')
const assetPath = (asset) => path.join(assetsDir, asset)

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2), 'utf8')

const assets = [
  `${name}-${version}-delta.nupkg`,
  `${name}-${version}-full.nupkg`,
  `${name}-amd64.deb`,
  `${name}-amd64.tar.gz`,
  `${name}-api.json`,
  `${name}-mac-symbols.zip`,
  `${name}-mac.zip`,
  `${name}-windows.zip`,
  `${name}-x64-${version}-delta.nupkg`,
  `${name}-x64-${version}-full.nupkg`,
  `${name}-x64-windows.zip`,
  `${name}.x86_64.rpm`,
  `${camelcase(name)}-x64.exe`,
  `${camelcase(name)}.exe`,
  `RELEASES`,
  `RELEASES-x64`
]

for (const fname of fs.readdirSync(assetsDir)) fs.unlinkSync(assetPath(fname))

const assetsOut = []
for (const asset of assets) {
  const filePath = assetPath(asset)
  fs.writeFileSync(filePath, '~')
  assetsOut.push(filePath)
}

const done = (err, release) => { console.log(err || release) }

publishRelease({
  token,
  owner: 'doesdev',
  repo: name,
  tag: version,
  name: `${name} v${version}`,
  notes: paragraph(randomValFromArray([2, 3, 4, 5])),
  draft: false,
  prerelease: releaseType.slice(0, 3) === 'pre',
  reuseRelease: true,
  reuseDraftOnly: true,
  skipAssetsCheck: false,
  skipDuplicatedAssets: true,
  skipIfPublished: true,
  editRelease: false,
  deleteEmptyTag: false,
  assets: assetsOut,
  target_commitish: 'master'
}, done)
