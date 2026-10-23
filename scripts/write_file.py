import base64, sys
open(sys.argv[1], 'wb').write(base64.b64decode(sys.argv[2]))
