const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
let database = null

const initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('\nServer is Running at: http://localhost:3000\n')
    })
  } catch (error) {
    console.log(error)
  }
}

initializeDatabaseAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'secrate', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const sqlGetQuery = `SELECT * FROM user WHERE username = '${username}';`
  const userData = await database.get(sqlGetQuery)
  if (userData === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, userData.password)
    if (!isPasswordCorrect) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payLoad = {username: username}
      const jwtToken = jwt.sign(payLoad, 'secrate')
      response.status(200)
      response.send({jwtToken})
    }
  }
})

const changeNotationOfStateObj = obj => ({
  stateId: obj.state_id,
  stateName: obj.state_name,
  population: obj.population,
})

const changeNotationOfStatesList = list => {
  const newList = []
  for (let i of list) {
    newList.push(changeNotationOfStateObj(i))
  }
  return newList
}

app.get('/states/', authenticateToken, async (request, response) => {
  const sqlGetQuery = `select * from state;`
  const results = await database.all(sqlGetQuery)
  response.send(changeNotationOfStatesList(results))
})

app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const sqlGetQuery = `select * from state where state_id = ${stateId};`
  const results = await database.get(sqlGetQuery)
  response.send(changeNotationOfStateObj(results))
})

app.post('/districts', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const sqlInsertQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`
  await database.run(sqlInsertQuery)
  response.send('District Successfully Added')
})

const changeNotationOfDistrictObj = obj => ({
  districtId: obj.district_id,
  districtName: obj.district_name,
  stateId: obj.state_id,
  cases: obj.cases,
  cured: obj.cured,
  active: obj.active,
  deaths: obj.deaths,
})

app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const sqlGetQuery = `select * from district where district_id = ${districtId};`
    const results = await database.get(sqlGetQuery)
    response.send(changeNotationOfDistrictObj(results))
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const sqldeleteQuery = `delete from district where district_id = ${districtId};`
    await database.run(sqldeleteQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const sqlUpdateQuery = `
  UPDATE district 
  SET 
  district_name = '${districtName}', 
  state_id = ${stateId},
  cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}
  WHERE district_id = ${districtId};`
    await database.run(sqlUpdateQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const sqlQuery = `select sum(cases)as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district where state_id = ${stateId}; `
    const results = await database.get(sqlQuery)
    response.send(results)
  },
)

module.exports = app
