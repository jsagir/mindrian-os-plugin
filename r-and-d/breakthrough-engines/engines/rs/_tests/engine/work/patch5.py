import sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read()
def rep(o,n,c=1):
    global s
    assert s.count(o)==c,(s.count(o),o[:70]); s=s.replace(o,n)
rep('''f"{output_path} (model={meta['embedding_model']}, edges={meta['edges_written']})",''','''f"{output_path} (model={meta.get('embedding_model', 'n/a')}, edges={meta.get('edges_written', 0)})",''')
rep('''                "engine_version": ENGINE_VERSION,
            },
            "pairs": [],
        }

    texts = [f"{a['title']}\\n{a['text']}" for a in artifacts]''','''                "engine_version": ENGINE_VERSION,
                "embedding_model": None,
                "edges_written": 0,
                "skip_reason": "fewer than 2 usable artifacts",
            },
            "pairs": [],
        }

    texts = [f"{a['title']}\\n{a['text']}" for a in artifacts]''')
open(p,"w",encoding="utf-8").write(s)
