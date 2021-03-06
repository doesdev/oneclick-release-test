'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { promisify } = require('util')
const git = require('simple-git')(__dirname)
const semver = require('semver')
const camelcase = require('camelcase')
const publishRelease = require('publish-release')
const { paragraph } = require('txtgen')
const { token } = require('./secrets.json')
const pkg = require('./package.json')
const { name, version: oldVersion } = pkg
const channels = ['default', 'VendorA', 'VendorB']
const BOM = String.fromCharCode(0xFEFF)

const getHashAndSize = (file) => new Promise((resolve, reject) => {
  let size = 0
  const hasher = crypto.createHash('sha1', { encoding: 'hex' })
  const filestream = fs.createReadStream(file)

  filestream.pipe(hasher)
  filestream.on('data', (d) => { size += d.length })
  filestream.on('end', () => {
    hasher.end()
    const hash = hasher.read()

    return resolve({ hash, size })
  })
})

const releaseTypes = [
  `major`,
  `premajor`,
  `minor`,
  `preminor`,
  `patch`,
  `prepatch`,
  `prerelease`
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
git.add(['package.json'], (err) => {
  if (err) throw err
  git.commit(`Release version ${version}`, (err) => {
    if (err) throw err
    git.push('origin', (err) => {
      if (err) throw err
    })
  })
})

const publishChannel = async (channel) => {
  const tmpVersion = channel === 'default' ? version : `${version}+${channel}`
  const assets = [
    `${name}-${tmpVersion}-delta.nupkg`,
    `${name}-${tmpVersion}-full.nupkg`,
    `${name}-amd64.deb`,
    `${name}-amd64.tar.gz`,
    `${name}-api.json`,
    `${name}-mac-symbols.zip`,
    `${name}-mac.zip`,
    `${name}-windows.zip`,
    `${name}-x64-${tmpVersion}-delta.nupkg`,
    `${name}-x64-${tmpVersion}-full.nupkg`,
    `${name}-x64-windows.zip`,
    `${name}.x86_64.rpm`,
    `${camelcase(name, { pascalCase: true })}-x64.exe`,
    `${camelcase(name, { pascalCase: true })}.exe`,
    `${camelcase(name, { pascalCase: true })}.dmg`
  ]

  const assetsOut = []
  for (const asset of assets) {
    const filePath = assetPath(asset)
    fs.writeFileSync(filePath, '~')
    assetsOut.push(filePath)
  }

  const releases = [
    {
      fileIn: `${name}-${tmpVersion}-full.nupkg`,
      fileOut: 'RELEASES'
    },
    {
      fileIn: `${name}-x64-${tmpVersion}-full.nupkg`,
      fileOut: 'RELEASES-x64'
    }
  ]
  for (const { fileIn, fileOut } of releases) {
    const filePathIn = assetPath(fileIn)
    const filePathOut = assetPath(fileOut)
    const { hash, size } = await getHashAndSize(filePathIn)
    fs.writeFileSync(filePathOut, `${BOM}${hash} ${fileIn} ${size}`, 'utf8')
    assetsOut.push(filePathOut)
  }

  await promisify(publishRelease)({
    token,
    owner: 'doesdev',
    repo: name,
    tag: tmpVersion,
    name: `${name} v${tmpVersion}`,
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
  })

  for (const fname of fs.readdirSync(assetsDir)) fs.unlinkSync(assetPath(fname))
}

const main = async () => {
  for (const channel of channels) {
    try {
      await publishChannel(channel)
    } catch (ex) {
      console.error(ex)
    }
  }

  console.log('Everything is published')
}

main()
