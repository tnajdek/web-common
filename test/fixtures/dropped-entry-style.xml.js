// Sorts by date and renders only the author, and the title of books. An item with neither sorts
// between the others, and citeproc-js leaves its entry out of the bibliography without recording
// an error
export default `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info>
    <title>Dropped entry test style</title>
    <id>dropped-entry-test-style</id>
    <updated>2026-11-25T00:00:00+00:00</updated>
  </info>
  <citation>
    <layout>
      <text variable="title"/>
    </layout>
  </citation>
  <bibliography>
    <sort>
      <key variable="issued"/>
    </sort>
    <layout>
      <group delimiter=". ">
        <names variable="author">
          <name and="text"/>
        </names>
        <choose>
          <if type="book">
            <text variable="title"/>
          </if>
        </choose>
      </group>
    </layout>
  </bibliography>
</style>`;
