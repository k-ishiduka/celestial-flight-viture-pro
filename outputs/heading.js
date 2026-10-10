// The standard Pro pose packet is roll, pitch, yaw in the NWU frame.
// Rendering uses Y-up, looking toward -Z. Keep roll disabled unless requested.
export function sensorView(raw, zero, { format = 'nwu', invertYaw = false, allowRoll = false } = {}) {
  const axis = format === 'nwu' ? [2, 1, 0] : [0, 2, 1];
  const delta = raw[axis[0]] - zero[axis[0]];
  const yaw = ((((delta + 180) % 360) + 360) % 360) - 180;
  return {
    yaw: invertYaw ? -yaw : yaw,
    pitch: -(raw[axis[1]] - zero[axis[1]]) || 0,
    roll: allowRoll ? raw[axis[2]] - zero[axis[2]] : 0,
  };
}
