import { parse } from 'svg-parser';
import parsePath from 'svg-path-parser';
import fs from 'fs';

const icons = fs.readdirSync("./icons")

const kotlinVectors = []
for (const iconFileName of icons) {
    const iconFileContents = fs.readFileSync("./icons/"+iconFileName, "utf8")
    const outputFileName = iconFileName.replaceAll(/(\.svg| )/ig, "")

    const svg = parse(iconFileContents)

    kotlinVectors.push({
        name: outputFileName,
        vector: generateKotlinImageVector(outputFileName, svg)
    })
}

fs.writeFileSync("./output/kotlin/ZnIcons.kt",
    `
package ru.zation
    
import androidx.compose.material.icons.materialIcon
import androidx.compose.material.icons.materialPath
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
    
object ZnIcons {
`+
    (kotlinVectors.map(it => {
        return `    val `+it.name.replace('Icon', '')+`: ImageVector = `+it.vector.replaceAll("\n", "\n    ")
    }).join('\n')) + `
}
    `
)


function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function generateKotlinImageVector(name, svg) {
    const parameterize = (param) => {
        if(typeof param === 'string')
            return '"'+param+'"'
        else if(typeof param === 'number') {
            return param + 'f'
        }
    }

    const buildFunction = (name, params) => {
        return name + "("
            + params.map(parameterize).join(", ")
            + ")"
    }

    let code = ""
    for (const child of svg.children[0].children) {
        const onParam = (name, action) => child.properties.hasOwnProperty(name)&&action(child.properties[name])

        switch (child.tagName) {
            case "path":
                code += "    path(\n"
                onParam("fill", it => code += "        fill=SolidColor(Color."+capitalizeFirstLetter(it)+"),\n")
                onParam("stroke", it => code += "        stroke=SolidColor(Color."+capitalizeFirstLetter(it)+"),\n")
                onParam("stroke-width", it => code += "        strokeLineWidth="+parameterize(it)+",\n")

                code += "){\n"

                onParam("d", d => {
                    for (const pathElement of parsePath(d)) {
                        code += "        "
                        switch (pathElement.code) {
                            case "L":
                                code += buildFunction(
                                    "lineTo",
                                    [pathElement.x, pathElement.y]
                                ) + "\n"
                                break;

                            case "M":
                                code += buildFunction(
                                    "moveTo",
                                    [pathElement.x, pathElement.y]
                                ) + "\n"
                                break;

                            case "V":
                                code += buildFunction(
                                    "verticalLineTo",
                                    [pathElement.y]
                                ) + "\n"
                                break;

                            case "H":
                                code += buildFunction(
                                    "horizontalLineTo",
                                    [pathElement.x]
                                ) + "\n"
                                break;

                            case "C":
                                code += buildFunction(
                                    "curveTo",
                                    [
                                        pathElement.x1,
                                        pathElement.y1,
                                        pathElement.x2,
                                        pathElement.y2,
                                        pathElement.x,
                                        pathElement.y,
                                    ]
                                ) + "\n"
                                break;

                            case "Z":
                                code += buildFunction(
                                    "close",
                                    []
                                ) + "\n"
                                break;

                            default:
                                const message = name+": Action "+pathElement.command+" not supported"
                                console.warn(message)
                                code += "println("+parameterize(message)+")\n"
                        }
                    }
                })

                code += "        close()\n"
                code += "}\n"


                break;

            default:
                const message = name+": Tag "+child.tagName+" not supported"
                console.warn(message)
                code += "    path() { println("+parameterize(message)+"); close() }\n"
        }
    }

    return "materialIcon(name = "+parameterize(name)+") {\n"
        +code.replaceAll("\n", "\n    ")
    +"}\n"
}