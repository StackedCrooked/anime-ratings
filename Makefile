JSL=./jsl

all:
	${JSL} -nosummary -conf jsl.conf -process eventPage.js -nologo -nofilelisting -nocontext 1>&2
	${JSL} -nosummary -conf jsl.conf -process content.js -nologo -nofilelisting -nocontext 1>&2
