import { Routes, Route } from 'react-router-dom'
import { ROUTES } from './routes'
import HomePage from '../views/Home/HomePage'

const AppRouter = () => {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />
    </Routes>
  )
}

export default AppRouter
