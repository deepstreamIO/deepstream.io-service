const exec = require('child_process').exec

const fs = require('fs')
const path = require('path')

const systemdTemplate = require('./template/systemd')
const initdTemplate = require('./template/initd')

/**
 * Returns true if system support systemd daemons
 * @return {Boolean}
 */
function hasSystemD () {
  return fs.existsSync('/usr/lib/systemd/system') || fs.existsSync('/bin/systemctl')
}

/**
 * Returns true if system support init.d daemons
 * @return {Boolean}
 */
function hasSystemV () {
  return fs.existsSync('/etc/init.d')
}

/**
 * Deletes a service file from /etc/systemd/system/
 */
function deleteSystemD (name, callback) {
  const filepath = `/etc/systemd/system/${name}.service`
  console.log(`Removing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if (exists) {
      fs.unlink(filepath, err => {
        if (err) {
          callback(err)
          return
        }

        let cmd = 'systemctl daemon-reload'
        console.log('Running %s...', cmd)
        exec(cmd, err => {
          callback(err, 'SystemD service removed succesfully')
        })
      })
    } else {
      callback(`Service doesn't exists, nothing to uninstall`)
    }
  })
}

/**
 * Installs a service file to /etc/systemd/system/
 *
 * It deals with logs, restarts and by default points
 * to the normal system install
 */
function setupSystemD (name, options, callback) {
  options.stdOut = (options.logDir && `${options.logDir}/${name}-out.log`) || null
  options.stdErr = (options.logDir && `${options.logDir}/${name}-err.log`) || null

  const filepath = `/etc/systemd/system/${name}.service`

  const script = systemdTemplate(options)

  if (options.dryRun) {
    console.log(script)
    return
  }

  console.log(`Installing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if(!exists) {
      fs.writeFile(filepath,script, err => {
        if (err) {
          callback(err)
          return
        }

        fs.chmod(filepath,'755', err => {
          if (err) {
            callback(err)
            return
          }

          let cmd = 'systemctl daemon-reload'
          console.log('Running %s...', cmd)
          exec(cmd, err => {
            callback(err, 'SystemD service registered succesfully')
          })
        })
      })
    } else {
      callback('Service already exists, please uninstall first')
    }
  })
}

/**
 * Deletes a service file from /etc/init.d/
 */
function deleteSystemV (name, callback) {
  const filepath = `/etc/init.d/${name}`
  console.log(`Removing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if (exists) {
      fs.unlink(filepath, err => {
        if (err) {
          callback(err)
          return
        }
        callback(err, 'SystemD service removed succesfully')
      })
    } else {
      callback(`Service doesn't exists, nothing to uninstall`)
    }
  })
}

/**
 * Installs a service file to /etc/init.d/
 *
 * It deals with logs, restarts and by default points
 * to the normal system install
 */
function setupSystemV (name, options, callback) {
  options.stdOut = (options.logDir && `${options.logDir}/${name}-out.log`) || '/dev/null'
  options.stdErr = (options.logDir && `${options.logDir}/${name}-err.log`) || '&1'

  const script = initdTemplate(options)

  if (options.dryRun) {
    console.log(script)
    return
  }

  const filepath = `/etc/init.d/${name}`
  console.log(`Installing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if(!exists) {
      fs.writeFile(filepath,script, err => {
        if (err) {
          callback(err)
          return
        }

        fs.chmod(filepath,'755', err => {
          if (err) {
            callback(err)
            return
          }

          callback(err, 'init.d service registered succesfully')
        })
      })
    } else {
      callback('Service already exists, please uninstall first')
    }
  })
}

/**
 * Adds a service, either via systemd or init.d
 * @param {String}   name the name of the service
 * @param {Object}   options  options to configure deepstream service
 * @param {Function} callback called when complete
 */
module.exports.add = function (name, options, callback) {
  options.name = name
  options.pidFile = options.pidFile || `/var/run/${name}.pid`

  options.exec = options.exec
  options.logDir = options.logDir || `/var/log/deepstream`
  options.user = options.user || 'root'
  options.group = options.group || 'root'

  if (options && !options.runLevels) {
    options.runLevels = [2, 3, 4, 5].join(' ')
  } else {
    options.runLevels = options.runLevels.join(' ')
  }

  if (!options.programArgs) {
    options.programArgs = []
  }
  options.deepstreamArgs = ['daemon'].concat(options.programArgs).join(' ')

 if (hasSystemD()) {
    setupSystemD(name, options, callback)
  } else if (hasSystemV()) {
    setupSystemV(name, options, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Delete a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
module.exports.remove = function (name, callback) {
  if (hasSystemD()) {
    deleteSystemD(name, callback)
  } else if (hasSystemV()) {
    deleteSystemV(name, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Start a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
module.exports.start = function (name, callback) {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} start`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Stop a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
module.exports.stop = function (name, callback) {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} stop`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Get the status of the service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
module.exports.status = function (name, callback) {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} status`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Restart the service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
module.exports.restart = function (name, callback) {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} restart`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}
