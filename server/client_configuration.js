const config = require("./configuration");

/** Settings that should be handed through to the clients  */
module.exports = {
  MAX_BOARD_SIZE: config.MAX_BOARD_SIZE,
  MAX_EMIT_COUNT: config.MAX_EMIT_COUNT,
  MAX_EMIT_COUNT_PERIOD: config.MAX_EMIT_COUNT_PERIOD,
  BLOCKED_TOOLS: config.BLOCKED_TOOLS,
  BLOCKED_SELECTION_BUTTONS: config.BLOCKED_SELECTION_BUTTONS,
  AUTO_FINGER_WHITEOUT: config.AUTO_FINGER_WHITEOUT,
  MAX_DOCUMENT_SIZE: config.MAX_DOCUMENT_SIZE,
  MINIMAL_LINE_WIDTH: config.MINIMAL_LINE_WIDTH,
  MAX_LINE_WIDTH: config.MAX_LINE_WIDTH,
};
