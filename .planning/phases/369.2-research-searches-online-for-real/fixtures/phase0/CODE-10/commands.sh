export HOME=$(mktemp -d /tmp/phase0-home-XXXX)
cd /home/jsagi/dev/MindrianOS-Plugin
env -u TYPESAFE_API_KEY -u JEV_API_KEY node scripts/eureka-jev-judge.cjs --help
env -u TYPESAFE_API_KEY -u JEV_API_KEY node scripts/eureka-jev-judge.cjs --room x --tag 20261005T000000Z
env -u TYPESAFE_API_KEY -u JEV_API_KEY node scripts/eureka-jev-judge.cjs --room x --run-tag 20261005T000000Z
env -u TYPESAFE_API_KEY -u JEV_API_KEY node scripts/eureka-jev-judge.cjs
# fixture room with 1 candidate, no key, HOME isolated
env -u TYPESAFE_API_KEY node scripts/eureka-jev-judge.cjs --room $ROOM --tag 20261005T000000Z
env -u TYPESAFE_API_KEY node scripts/eureka-jev-judge.cjs --room $ROOM --run-tag 20261005T000000Z
