import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'

// Exposes router state, which the workspace only changes through the URL.
export function LocationProbe() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Location">{`${pathname}${search}`}</output>
      <Button onClick={() => void navigate(-1)}>Go back</Button>
    </>
  )
}
